use reqwest::Client;
use serde_json::{json, Map, Value};
use tokio::time::{sleep, Duration};
use uuid::Uuid;

use crate::ai::error::AIError;
use crate::ai::{
    GenerateRequest, ProviderTaskHandle, ProviderTaskPollResult, ProviderTaskSubmission,
    RuntimeProviderConfig,
};

const POLL_INTERVAL_MS: u64 = 2000;

fn trim(value: Option<&str>) -> String {
    value.unwrap_or_default().trim().to_string()
}

fn normalize_base_url(value: Option<&str>) -> String {
    trim(value).trim_end_matches('/').to_string()
}

fn build_request_id() -> String {
    let bytes = Uuid::new_v4().into_bytes();
    let value = bytes
        .iter()
        .take(8)
        .fold(0_u128, |acc, byte| (acc << 8) | (*byte as u128));
    format!("{:011}", value % 100_000_000_000_u128)
}

fn build_submit_endpoint(base_url: &str) -> String {
    format!("{}/xais/workerTaskStart", base_url.trim_end_matches('/'))
}

fn build_wait_endpoint(base_url: &str, task_id: &str) -> String {
    format!(
        "{}/xais/workerTaskWait?id={}&json=true",
        base_url.trim_end_matches('/'),
        urlencoding::encode(task_id)
    )
}

pub fn build_asset_url(asset_base_url: &str, asset_key: &str) -> String {
    let trimmed_key = asset_key.trim();
    if trimmed_key.starts_with("http://") || trimmed_key.starts_with("https://") {
        return trimmed_key.to_string();
    }

    format!(
        "{}/xais/img?att={}",
        asset_base_url.trim_end_matches('/'),
        urlencoding::encode(trimmed_key)
    )
}

fn normalize_reference_images(request: &GenerateRequest) -> Result<Vec<String>, AIError> {
    let images = request
        .reference_images
        .as_ref()
        .map(|images| {
            images
                .iter()
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
                .map(|value| value.to_string())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    for image in &images {
        let lower = image.to_ascii_lowercase();
        let looks_like_local_path =
            image.len() > 2 && image.as_bytes().get(1) == Some(&b':') && image.as_bytes().get(2) == Some(&b'\\');
        if lower.starts_with("data:") || lower.starts_with("file://") || looks_like_local_path {
            return Err(AIError::InvalidRequest(
                "xais-task reference images must be remote URLs or existing xais asset keys".to_string(),
            ));
        }
    }

    Ok(images)
}

pub fn build_submit_body(request: &GenerateRequest, runtime: &RuntimeProviderConfig) -> Value {
    let mut body = Map::new();
    body.insert("prompt".to_string(), Value::String(request.prompt.trim().to_string()));
    body.insert(
        "model".to_string(),
        Value::String(trim(runtime.remote_model_id.as_deref())),
    );

    let references = normalize_reference_images(request).unwrap_or_default();
    if !references.is_empty() {
        body.insert(
            "ref".to_string(),
            Value::Array(references.into_iter().map(Value::String).collect()),
        );
    }

    let ratio = request.aspect_ratio.trim();
    if !ratio.is_empty() && ratio.contains(':') {
        body.insert("ratio".to_string(), Value::String(ratio.to_string()));
    }

    let output_format = trim(runtime.default_output_format.as_deref());
    if !output_format.is_empty() {
        body.insert(
            "custom_field".to_string(),
            json!({
                "outputFormat": output_format
            }),
        );
    }

    Value::Object(body)
}

fn extract_task_id(value: &Value) -> Option<String> {
    extract_string_like(value).or_else(|| {
        [
            "/id",
            "/taskId",
            "/taskID",
            "/task_id",
            "/data",
            "/data/id",
            "/data/taskId",
            "/data/taskID",
            "/data/task_id",
            "/data/task/id",
            "/data/task/taskId",
            "/data/task/taskID",
            "/data/task/task_id",
            "/result",
            "/result/id",
            "/result/taskId",
            "/result/taskID",
            "/result/task_id",
            "/task",
            "/task/id",
            "/task/taskId",
            "/task/taskID",
            "/task/task_id",
        ]
        .into_iter()
        .find_map(|pointer| value.pointer(pointer).and_then(extract_string_like))
    })
}

fn extract_string_like(value: &Value) -> Option<String> {
    match value {
        Value::String(raw) => Some(raw.trim().to_string()),
        Value::Number(raw) => Some(raw.to_string()),
        _ => None,
    }
    .filter(|raw| !raw.is_empty())
}

fn json_value_kind(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "bool",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

fn summarize_submit_response(value: &Value) -> String {
    match value {
        Value::Object(map) => {
            let mut entries = Vec::new();

            for (key, nested) in map.iter().take(6) {
                entries.push(format!("{}<{}>", key, json_value_kind(nested)));
            }

            for container in ["data", "result", "task"] {
                if let Some(Value::Object(nested)) = map.get(container) {
                    for (key, child) in nested.iter().take(4) {
                        entries.push(format!(
                            "{}.{}<{}>",
                            container,
                            key,
                            json_value_kind(child)
                        ));
                    }
                }
            }

            if entries.is_empty() {
                "object<empty>".to_string()
            } else {
                entries.join(", ")
            }
        }
        Value::String(raw) => format!("string(len={})", raw.len()),
        Value::Array(items) => format!("array(len={})", items.len()),
        other => json_value_kind(other).to_string(),
    }
}

fn extract_error_message(value: &Value) -> Option<String> {
    value
        .get("error")
        .and_then(|raw| {
            raw.as_str().map(|value| value.to_string()).or_else(|| {
                if raw.is_null() {
                    None
                } else {
                    Some(raw.to_string())
                }
            })
        })
        .filter(|value| !value.trim().is_empty())
}

pub fn parse_wait_response(
    value: &Value,
    runtime: &RuntimeProviderConfig,
) -> Result<ProviderTaskPollResult, AIError> {
    if let Some(message) = extract_error_message(value) {
        return Ok(ProviderTaskPollResult::Failed(message));
    }

    let result = value
        .get("result")
        .and_then(|raw| raw.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.as_str())
        .map(|item| item.trim())
        .filter(|item| !item.is_empty());

    if let Some(asset_key) = result {
        let asset_base_url = normalize_base_url(runtime.asset_base_url.as_deref());
        if asset_base_url.is_empty() {
            return Err(AIError::InvalidRequest(
                "custom xais-task provider missing assetBaseUrl".to_string(),
            ));
        }
        return Ok(ProviderTaskPollResult::Succeeded(build_asset_url(
            asset_base_url.as_str(),
            asset_key,
        )));
    }

    Ok(ProviderTaskPollResult::Running)
}

fn validate_submit_runtime(runtime: &RuntimeProviderConfig) -> Result<(String, String, String), AIError> {
    let submit_base_url = normalize_base_url(runtime.submit_base_url.as_deref());
    let api_key = trim(runtime.api_key.as_deref());
    let remote_model_id = trim(runtime.remote_model_id.as_deref());

    if submit_base_url.is_empty() {
        return Err(AIError::InvalidRequest(
            "custom xais-task provider missing submitBaseUrl".to_string(),
        ));
    }
    if api_key.is_empty() {
        return Err(AIError::InvalidRequest(
            "custom xais-task provider missing apiKey".to_string(),
        ));
    }
    if remote_model_id.is_empty() {
        return Err(AIError::InvalidRequest(
            "custom xais-task provider missing remoteModelId".to_string(),
        ));
    }

    Ok((submit_base_url, api_key, remote_model_id))
}

fn validate_wait_runtime(runtime: &RuntimeProviderConfig) -> Result<(String, String), AIError> {
    let wait_base_url = normalize_base_url(runtime.wait_base_url.as_deref());
    let api_key = trim(runtime.api_key.as_deref());

    if wait_base_url.is_empty() {
        return Err(AIError::InvalidRequest(
            "custom xais-task provider missing waitBaseUrl".to_string(),
        ));
    }
    if api_key.is_empty() {
        return Err(AIError::InvalidRequest(
            "custom xais-task provider missing apiKey".to_string(),
        ));
    }

    Ok((wait_base_url, api_key))
}

pub async fn submit_task(
    request: &GenerateRequest,
    runtime: &RuntimeProviderConfig,
) -> Result<ProviderTaskSubmission, AIError> {
    let (submit_base_url, api_key, _) = validate_submit_runtime(runtime)?;
    let endpoint = build_submit_endpoint(submit_base_url.as_str());
    let _references = normalize_reference_images(request)?;
    let body = build_submit_body(request, runtime);

    let response = Client::new()
        .post(endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("x-request-id", build_request_id())
        .json(&body)
        .send()
        .await?
        .error_for_status()?;

    let value = response.json::<Value>().await?;
    let task_id = extract_task_id(&value).ok_or_else(|| {
        AIError::Provider(format!(
            "XAIS task submission response missing task id; response shape={}",
            summarize_submit_response(&value)
        ))
    })?;

    Ok(ProviderTaskSubmission::Queued(ProviderTaskHandle {
        task_id,
        metadata: None,
    }))
}

pub async fn poll_task(
    handle: ProviderTaskHandle,
    runtime: &RuntimeProviderConfig,
) -> Result<ProviderTaskPollResult, AIError> {
    let (wait_base_url, api_key) = validate_wait_runtime(runtime)?;
    let endpoint = build_wait_endpoint(wait_base_url.as_str(), handle.task_id.as_str());

    let response = Client::new()
        .get(endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await?
        .error_for_status()?;

    let value = response.json::<Value>().await?;
    parse_wait_response(&value, runtime)
}

pub async fn generate(
    request: &GenerateRequest,
    runtime: &RuntimeProviderConfig,
) -> Result<String, AIError> {
    let handle = match submit_task(request, runtime).await? {
        ProviderTaskSubmission::Succeeded(result) => return Ok(result),
        ProviderTaskSubmission::Queued(handle) => handle,
    };

    loop {
        match poll_task(handle.clone(), runtime).await? {
            ProviderTaskPollResult::Running => sleep(Duration::from_millis(POLL_INTERVAL_MS)).await,
            ProviderTaskPollResult::Succeeded(url) => return Ok(url),
            ProviderTaskPollResult::Failed(message) => return Err(AIError::TaskFailed(message)),
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::ai::{GenerateRequest, RuntimeProviderConfig};

    use super::{
        build_asset_url, build_submit_body, extract_task_id, parse_wait_response,
        summarize_submit_response,
    };

    fn runtime() -> RuntimeProviderConfig {
        RuntimeProviderConfig {
            kind: "custom-provider".to_string(),
            provider_profile_id: Some("gateway-xais".to_string()),
            provider_display_name: Some("Xais Gateway".to_string()),
            protocol: Some("xais-task".to_string()),
            base_url: None,
            api_key: Some("token-xais".to_string()),
            submit_base_url: Some("https://sg2c.dchai.cn".to_string()),
            wait_base_url: Some("https://sg2.dchai.cn".to_string()),
            asset_base_url: Some("https://svt1.dchai.cn".to_string()),
            default_output_format: Some("image/png".to_string()),
            remote_model_id: Some("Nano_Banana_Pro_2K_0".to_string()),
        }
    }

    fn request() -> GenerateRequest {
        GenerateRequest {
            prompt: "改为油画风格".to_string(),
            model: "custom-provider:gateway-xais:model-main".to_string(),
            size: "1K".to_string(),
            aspect_ratio: "16:9".to_string(),
            reference_images: Some(vec![
                "https://example.com/ref.png".to_string(),
                "hz/260416/200/BggaevGQ.png".to_string(),
            ]),
            extra_params: None,
            provider_runtime: None,
        }
    }

    #[test]
    fn build_submit_body_maps_prompt_refs_ratio_and_output_format() {
        let body = build_submit_body(&request(), &runtime());
        assert_eq!(body["prompt"], "改为油画风格");
        assert_eq!(body["model"], "Nano_Banana_Pro_2K_0");
        assert_eq!(body["ratio"], "16:9");
        assert_eq!(body["custom_field"]["outputFormat"], "image/png");
        assert_eq!(body["ref"][0], "https://example.com/ref.png");
        assert_eq!(body["ref"][1], "hz/260416/200/BggaevGQ.png");
    }

    #[test]
    fn extract_task_id_supports_common_submission_response_shapes() {
        assert_eq!(
            extract_task_id(&json!({ "data": { "taskId": "task-from-data-task-id" } }))
                .as_deref(),
            Some("task-from-data-task-id")
        );
        assert_eq!(
            extract_task_id(&json!({ "data": { "task_id": "task-from-data-task-id-snake" } }))
                .as_deref(),
            Some("task-from-data-task-id-snake")
        );
        assert_eq!(
            extract_task_id(&json!({ "id": 12345 })).as_deref(),
            Some("12345")
        );
    }

    #[test]
    fn summarize_submit_response_includes_nested_keys() {
        let summary = summarize_submit_response(&json!({
            "code": 0,
            "msg": "ok",
            "data": {
                "taskId": "task-123",
                "status": "queued"
            }
        }));

        assert!(summary.contains("code<number>"));
        assert!(summary.contains("data<object>"));
        assert!(summary.contains("data.taskId<string>"));
    }

    #[test]
    fn parse_wait_response_returns_running_without_result() {
        let result = parse_wait_response(&json!({ "error": null, "progress": 55 }), &runtime())
            .expect("wait response should parse");
        assert!(matches!(result, crate::ai::ProviderTaskPollResult::Running));
    }

    #[test]
    fn parse_wait_response_converts_asset_key_to_stable_url() {
        let result = parse_wait_response(
            &json!({
                "error": null,
                "result": ["d5/260422/200/CC7M3DHCA_6A.png"]
            }),
            &runtime(),
        )
        .expect("wait response should parse");

        match result {
            crate::ai::ProviderTaskPollResult::Succeeded(url) => {
                assert_eq!(
                    url,
                    "https://svt1.dchai.cn/xais/img?att=d5%2F260422%2F200%2FCC7M3DHCA_6A.png"
                );
            }
            other => panic!("expected succeeded result, got {:?}", other),
        }
    }

    #[test]
    fn build_asset_url_keeps_absolute_urls() {
        assert_eq!(
            build_asset_url("https://svt1.dchai.cn", "https://cdn.example.com/result.png"),
            "https://cdn.example.com/result.png"
        );
    }

    #[test]
    fn build_submit_body_skips_incompatible_local_reference_validation_to_submit_step() {
        let invalid_request = GenerateRequest {
            reference_images: Some(vec!["file:///C:/tmp/ref.png".to_string()]),
            ..request()
        };

        let result = super::normalize_reference_images(&invalid_request);
        assert!(result.is_err());
    }
}
