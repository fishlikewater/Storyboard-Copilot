use reqwest::Client;
use serde_json::{json, Value};

use crate::ai::error::AIError;
use crate::ai::{GenerateRequest, RuntimeProviderConfig};

fn trim(value: Option<&str>) -> String {
    value.unwrap_or_default().trim().to_string()
}

pub fn build_final_prompt(prompt: &str, aspect_ratio: &str) -> String {
    let trimmed_prompt = prompt.trim();
    let trimmed_ratio = aspect_ratio.trim();
    let aspect_ratio_text = format!(
        "\u{56fe}\u{7247}\u{957f}\u{5bbd}\u{6bd4}{}",
        trimmed_ratio
    );

    if trimmed_ratio.is_empty() {
        return trimmed_prompt.to_string();
    }

    if trimmed_prompt.is_empty() {
        return aspect_ratio_text;
    }

    format!("{trimmed_prompt}\u{ff0c}{aspect_ratio_text}")
}

pub fn build_messages(prompt: &str, aspect_ratio: &str, references: &[String]) -> Value {
    let final_prompt = build_final_prompt(prompt, aspect_ratio);
    if references.is_empty() {
        return json!([
            {
                "role": "user",
                "content": final_prompt
            }
        ]);
    }

    let mut content = vec![json!({
        "type": "text",
        "text": final_prompt
    })];

    for reference in references {
        content.push(json!({
            "type": "image_url",
            "image_url": {
                "url": reference
            }
        }));
    }

    json!([
        {
            "role": "user",
            "content": content
        }
    ])
}

pub fn extract_markdown_image_url(content: &str) -> Option<String> {
    let marker_start = content.find("](")?;
    let url_part = &content[(marker_start + 2)..];
    let marker_end = url_part.find(')')?;
    let url = url_part[..marker_end].trim();
    if url.is_empty() {
        return None;
    }
    Some(url.to_string())
}

pub async fn generate(
    request: &GenerateRequest,
    runtime: &RuntimeProviderConfig,
) -> Result<String, AIError> {
    let base_url = trim(runtime.base_url.as_deref());
    let api_key = trim(runtime.api_key.as_deref());
    let remote_model_id = trim(runtime.remote_model_id.as_deref());

    if base_url.is_empty() {
        return Err(AIError::InvalidRequest(
            "custom openapi provider missing baseUrl".to_string(),
        ));
    }
    if api_key.is_empty() {
        return Err(AIError::InvalidRequest(
            "custom openapi provider missing apiKey".to_string(),
        ));
    }
    if remote_model_id.is_empty() {
        return Err(AIError::InvalidRequest(
            "custom openapi provider missing remoteModelId".to_string(),
        ));
    }

    let empty_refs: &[String] = &[];
    let reference_images = request.reference_images.as_deref().unwrap_or(empty_refs);
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let response = Client::new()
        .post(endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&json!({
            "model": remote_model_id,
            "messages": build_messages(
                request.prompt.as_str(),
                request.aspect_ratio.as_str(),
                reference_images,
            )
        }))
        .send()
        .await?
        .error_for_status()?;

    let body = response.json::<Value>().await?;
    let content = body
        .pointer("/choices/0/message/content")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            AIError::Provider(
                "OpenAPI response missing choices[0].message.content".to_string(),
            )
        })?;

    extract_markdown_image_url(content).ok_or_else(|| {
        AIError::Provider(format!(
            "OpenAPI response does not contain a markdown image url: {}",
            content
        ))
    })
}

#[cfg(test)]
mod tests {
    use super::{build_final_prompt, build_messages, extract_markdown_image_url};

    #[test]
    fn build_final_prompt_appends_aspect_ratio() {
        assert_eq!(
            build_final_prompt("夕阳美景", "9:16"),
            "夕阳美景，图片长宽比9:16"
        );
    }

    #[test]
    fn build_messages_uses_text_and_image_inputs() {
        let messages = build_messages(
            "改为油画风格",
            "1:1",
            &vec!["https://example.com/ref.png".to_string()],
        );
        let raw = messages.to_string();
        assert!(raw.contains("\"image_url\""));
        assert!(raw.contains("图片长宽比1:1"));
    }

    #[test]
    fn extract_markdown_image_url_returns_first_url() {
        let url = extract_markdown_image_url("![image](https://example.com/result.png)");
        assert_eq!(url.as_deref(), Some("https://example.com/result.png"));
    }
}
