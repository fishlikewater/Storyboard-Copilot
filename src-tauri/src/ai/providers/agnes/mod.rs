use reqwest::Client;
use serde_json::{json, Value};

use crate::ai::error::AIError;
use crate::ai::{GenerateRequest, RuntimeProviderConfig};

const AGNES_DEFAULT_MODEL: &str = "agnes-image-2.1-flash";
const AGNES_IMAGE_MAX_REFERENCE_IMAGES: usize = 16;

fn trim(value: Option<&str>) -> String {
    value.unwrap_or_default().trim().to_string()
}

fn validate_runtime(runtime: &RuntimeProviderConfig) -> Result<(String, String, String), AIError> {
    let base_url = trim(runtime.base_url.as_deref())
        .trim_end_matches('/')
        .to_string();
    let api_key = trim(runtime.api_key.as_deref());
    let remote_model_id = trim(runtime.remote_model_id.as_deref());

    if base_url.is_empty() {
        return Err(AIError::InvalidRequest(
            "Agnes provider missing baseUrl".to_string(),
        ));
    }
    if api_key.is_empty() {
        return Err(AIError::InvalidRequest(
            "Agnes provider missing apiKey".to_string(),
        ));
    }
    if remote_model_id.is_empty() {
        return Err(AIError::InvalidRequest(
            "Agnes provider missing remoteModelId".to_string(),
        ));
    }

    Ok((base_url, api_key, remote_model_id))
}

fn build_final_prompt(request: &GenerateRequest) -> String {
    let prompt = request.prompt.trim().to_string();
    prompt
}

fn resolve_agnes_image_size(request: &GenerateRequest) -> String {
    let explicit_size = request.size.trim();
    if explicit_size.eq_ignore_ascii_case("auto") || explicit_size.contains('x') {
        return explicit_size.to_string();
    }

    let aspect_ratio = request.aspect_ratio.trim();
    let Some((width, height)) = aspect_ratio.split_once(':') else {
        return "1024x1024".to_string();
    };
    let width = width.trim().parse::<f64>().unwrap_or(1.0);
    let height = height.trim().parse::<f64>().unwrap_or(1.0);
    if width <= 0.0 || height <= 0.0 {
        return "1024x1024".to_string();
    }

    let ratio = width / height;
    if ratio > 1.05 {
        "1536x1024".to_string()
    } else if ratio < 0.95 {
        "1024x1536".to_string()
    } else {
        "1024x1024".to_string()
    }
}

fn resolve_model(_request: &GenerateRequest, runtime: &RuntimeProviderConfig) -> String {
    let (_, _, remote_model_id) = validate_runtime(runtime).unwrap_or_default();
    if remote_model_id.is_empty() {
        AGNES_DEFAULT_MODEL.to_string()
    } else {
        remote_model_id
    }
}

pub fn build_generation_body(
    request: &GenerateRequest,
    runtime: &RuntimeProviderConfig,
) -> Result<Value, AIError> {
    let (_, _, _) = validate_runtime(runtime)?;
    let model = resolve_model(request, runtime);

    let mut body = json!({
        "model": model,
        "prompt": build_final_prompt(request),
        "size": resolve_agnes_image_size(request),
        "n": 1
    });

    if let Some(ref images) = request.reference_images {
        let filtered: Vec<&str> = images
            .iter()
            .map(|v| v.trim())
            .filter(|v| !v.is_empty())
            .collect();
        if !filtered.is_empty() {
            if let Some(extra_body) = body.get_mut("extra_body") {
                if let Some(extra) = extra_body.as_object_mut() {
                    extra.insert("image".to_string(), json!(filtered));
                }
            } else {
                body["extra_body"] = json!({ "image": filtered });
            }
        }
    }

    if let Some(ref extra_params) = request.extra_params {
        if let Some(extra_body) = body.get_mut("extra_body") {
            if let Some(extra) = extra_body.as_object_mut() {
                if let Some(format) = extra_params.get("response_format") {
                    extra.insert("response_format".to_string(), format.clone());
                }
                if let Some(return_base64) = extra_params.get("return_base64") {
                    if let Some(true) = return_base64.as_bool() {
                        body["return_base64"] = true.into();
                    }
                }
            }
        }
    }

    Ok(body)
}

fn collect_image_urls(request: &GenerateRequest) -> Result<Vec<String>, AIError> {
    let images: Vec<String> = request
        .reference_images
        .as_ref()
        .map(|values| {
            values
                .iter()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .collect()
        })
        .unwrap_or_default();

    if images.is_empty() {
        return Err(AIError::InvalidRequest(
            "Agnes edit requires reference images".to_string(),
        ));
    }
    if images.len() > AGNES_IMAGE_MAX_REFERENCE_IMAGES {
        return Err(AIError::InvalidRequest(format!(
            "Agnes edit supports at most {} reference images",
            AGNES_IMAGE_MAX_REFERENCE_IMAGES
        )));
    }

    Ok(images)
}

pub fn parse_image_response(value: &Value) -> Result<String, AIError> {
    if let Some(payload) = value
        .pointer("/data/0/b64_json")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(format!("data:image/png;base64,{}", payload));
    }

    if let Some(url) = value
        .pointer("/data/0/url")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(url.to_string());
    }

    Err(AIError::Provider(
        "Agnes Images response missing data[0].b64_json or data[0].url".to_string(),
    ))
}

pub async fn generate(
    request: &GenerateRequest,
    runtime: &RuntimeProviderConfig,
) -> Result<String, AIError> {
    let (base_url, api_key, _) = validate_runtime(runtime)?;
    let endpoint = format!("{}/images/generations", base_url);
    let body = build_generation_body(request, runtime)?;

    let response = Client::new()
        .post(endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?
        .error_for_status()?;

    let body = response.json::<Value>().await?;
    parse_image_response(&body)
}

pub async fn edit(
    request: &GenerateRequest,
    runtime: &RuntimeProviderConfig,
) -> Result<String, AIError> {
    let _ = collect_image_urls(request)?;
    let (base_url, api_key, _) = validate_runtime(runtime)?;
    let endpoint = format!("{}/images/generations", base_url);
    let body = build_generation_body(request, runtime)?;

    let response = Client::new()
        .post(endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?
        .error_for_status()?;

    let body = response.json::<Value>().await?;
    parse_image_response(&body)
}

#[cfg(test)]
mod tests {
    use crate::ai::{GenerateRequest, RuntimeProviderConfig};

    use super::{
        build_generation_body, collect_image_urls, parse_image_response, resolve_agnes_image_size,
    };

    fn runtime() -> RuntimeProviderConfig {
        RuntimeProviderConfig {
            kind: "custom-provider".to_string(),
            provider_profile_id: Some("agnes-images".to_string()),
            provider_display_name: Some("Agnes Images".to_string()),
            protocol: Some("agnes".to_string()),
            base_url: Some("https://apihub.agnes-ai.com/v1".to_string()),
            api_key: Some("sk-agnes".to_string()),
            remote_model_id: Some("agnes-image-2.1-flash".to_string()),
        }
    }

    fn request() -> GenerateRequest {
        GenerateRequest {
            prompt: "a beautiful landscape".to_string(),
            model: "custom-provider:agnes-images:agnes-image".to_string(),
            size: "1K".to_string(),
            aspect_ratio: "16:9".to_string(),
            action: None,
            reference_images: None,
            extra_params: None,
            provider_runtime: None,
        }
    }

    #[test]
    fn build_generation_body_maps_prompt_model_and_count() {
        let body = build_generation_body(&request(), &runtime()).expect("body");

        assert_eq!(body["model"], "agnes-image-2.1-flash");
        assert!(body["prompt"]
            .as_str()
            .expect("prompt")
            .contains("a beautiful landscape"));
        assert_eq!(body["size"], "1536x1024");
        assert_eq!(body["n"], 1);
    }

    #[test]
    fn resolve_agnes_image_size_maps_supported_aspect_ratios() {
        let mut square = request();
        square.aspect_ratio = "1:1".to_string();
        assert_eq!(resolve_agnes_image_size(&square), "1024x1024");

        let mut portrait = request();
        portrait.aspect_ratio = "9:16".to_string();
        assert_eq!(resolve_agnes_image_size(&portrait), "1024x1536");

        let mut official = request();
        official.size = "2048x2048".to_string();
        assert_eq!(resolve_agnes_image_size(&official), "2048x2048");
    }

    #[test]
    fn build_generation_body_includes_images_in_extra_body() {
        let mut req = request();
        req.reference_images = Some(vec![
            "https://example.com/image1.png".to_string(),
            "data:image/png;base64,abc".to_string(),
        ]);

        let body = build_generation_body(&req, &runtime()).expect("body");
        assert_eq!(
            body["extra_body"]["image"],
            serde_json::json!([
                "https://example.com/image1.png",
                "data:image/png;base64,abc"
            ])
        );
    }

    #[test]
    fn collect_image_urls_accepts_urls_and_data_urls() {
        let mut req = request();
        req.reference_images = Some(vec![
            "https://example.com/image.png".to_string(),
            "data:image/png;base64,abc".to_string(),
        ]);

        let urls = collect_image_urls(&req).expect("urls");
        assert_eq!(urls.len(), 2);
    }

    #[test]
    fn collect_image_urls_rejects_missing_reference_images() {
        let error = collect_image_urls(&request()).expect_err("missing refs should fail");
        assert!(error.to_string().contains("reference images"));
    }

    #[test]
    fn collect_image_urls_rejects_more_than_limit() {
        let mut req = request();
        req.reference_images = Some(
            (0..17)
                .map(|_| "data:image/png;base64,abc".to_string())
                .collect(),
        );

        let error = collect_image_urls(&req).expect_err("too many refs should fail");
        assert!(error.to_string().contains("at most 16"));
    }

    #[test]
    fn parse_image_response_prefers_b64_json() {
        let result = parse_image_response(&serde_json::json!({
            "data": [{ "b64_json": "abc123", "url": "https://example.com/result.png" }]
        }))
        .expect("image");

        assert_eq!(result, "data:image/png;base64,abc123");
    }

    #[test]
    fn parse_image_response_accepts_url() {
        let result = parse_image_response(&serde_json::json!({
            "data": [{ "url": "https://example.com/result.png" }]
        }))
        .expect("image");

        assert_eq!(result, "https://example.com/result.png");
    }
}
