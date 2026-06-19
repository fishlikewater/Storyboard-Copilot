use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

use crate::ai::error::AIError;
use crate::ai::{
    AIProvider, GenerateRequest, ProviderTaskHandle, ProviderTaskPollResult,
    ProviderTaskSubmission, RuntimeProviderConfig,
};

const AGNES_VIDEO_DEFAULT_MODEL: &str = "agnes-video-v2.0";
const AGNES_VIDEO_MAX_REFERENCE_IMAGES: usize = 16;

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
            "Agnes Video provider missing baseUrl".to_string(),
        ));
    }
    if api_key.is_empty() {
        return Err(AIError::InvalidRequest(
            "Agnes Video provider missing apiKey".to_string(),
        ));
    }
    if remote_model_id.is_empty() {
        return Err(AIError::InvalidRequest(
            "Agnes Video provider missing remoteModelId".to_string(),
        ));
    }

    Ok((base_url, api_key, remote_model_id))
}

fn collect_reference_urls(request: &GenerateRequest) -> Result<Vec<String>, AIError> {
    let refs = match &request.reference_images {
        Some(refs) if !refs.is_empty() => refs,
        _ => return Ok(Vec::new()),
    };

    if refs.len() > AGNES_VIDEO_MAX_REFERENCE_IMAGES {
        return Err(AIError::InvalidRequest(format!(
            "Agnes Video supports at most {} reference images, got {}",
            AGNES_VIDEO_MAX_REFERENCE_IMAGES,
            refs.len()
        )));
    }

    refs.iter()
        .map(|url| {
            let trimmed = url.trim().to_string();
            if trimmed.is_empty() {
                return Err(AIError::InvalidRequest(
                    "Empty reference image URL".to_string(),
                ));
            }
            Ok(trimmed)
        })
        .collect()
}

#[derive(Debug, Deserialize)]
struct CreateTaskResponse {
    task_id: Option<String>,
    video_id: Option<String>,
    request_id: Option<String>,
    status: Option<String>,
}

fn parse_create_response(body: &Value) -> Result<String, AIError> {
    if let Some(video_id) = body.get("video_id").and_then(|v| v.as_str()) {
        if !video_id.is_empty() {
            return Ok(video_id.to_string());
        }
    }
    if let Some(task_id) = body.get("task_id").and_then(|v| v.as_str()) {
        if !task_id.is_empty() {
            return Ok(task_id.to_string());
        }
    }
    if let Some(request_id) = body.get("request_id").and_then(|v| v.as_str()) {
        if !request_id.is_empty() {
            return Ok(request_id.to_string());
        }
    }
    Err(AIError::Provider(format!(
        "Agnes Video: no video_id or task_id in create response: {}",
        body
    )))
}

#[derive(Debug, Deserialize)]
struct PollStatusResponse {
    status: Option<String>,
    video_url: Option<String>,
    error: Option<String>,
    progress: Option<Value>,
}

fn parse_poll_response(body: &Value) -> Result<ProviderTaskPollResult, AIError> {
    let status = body
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();

    match status.as_str() {
        "completed" => {
            let video_url = body
                .get("video_url")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            match video_url {
                Some(url) if !url.is_empty() => Ok(ProviderTaskPollResult::Succeeded(url)),
                _ => Err(AIError::Provider(
                    "Agnes Video: status=completed but no video_url".to_string(),
                )),
            }
        }
        "failed" | "error" => {
            let msg = body
                .get("error")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown error")
                .to_string();
            Ok(ProviderTaskPollResult::Failed(msg))
        }
        _ => Ok(ProviderTaskPollResult::Running),
    }
}

pub struct AgnesVideoProvider {
    client: Client,
    api_key: Arc<RwLock<Option<String>>>,
}

impl AgnesVideoProvider {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            api_key: Arc::new(RwLock::new(None)),
        }
    }

    async fn update_api_key(&self, key: &str) {
        let mut guard = self.api_key.write().await;
        *guard = Some(key.to_string());
    }

    fn build_create_url(base_url: &str) -> String {
        format!("{}/v1/videos", base_url)
    }

    fn build_poll_url(base_url: &str, video_id: &str) -> String {
        format!("{}/agnesapi?video_id={}", base_url, video_id)
    }
}

impl Default for AgnesVideoProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl AIProvider for AgnesVideoProvider {
    fn name(&self) -> &str {
        "agnes_video"
    }

    fn supports_model(&self, model: &str) -> bool {
        model.contains("video") || model.starts_with("agnes-video")
    }

    fn list_models(&self) -> Vec<String> {
        vec![AGNES_VIDEO_DEFAULT_MODEL.to_string()]
    }

    fn supports_task_resume(&self) -> bool {
        true
    }

    async fn submit_task(
        &self,
        request: GenerateRequest,
    ) -> Result<ProviderTaskSubmission, AIError> {
        let runtime = request
            .provider_runtime
            .as_ref()
            .ok_or_else(|| AIError::InvalidRequest("Agnes Video: missing provider_runtime".into()))?;

        let (base_url, api_key, remote_model_id) = validate_runtime(runtime)?;
        self.update_api_key(&api_key).await;

        let mut body = json!({
            "model": remote_model_id,
            "prompt": request.prompt,
        });

        // Image-to-video: pass image URL(s) if present
        let ref_urls = collect_reference_urls(&request)?;
        if ref_urls.len() == 1 {
            body["image"] = json!(ref_urls[0]);
        } else if ref_urls.len() > 1 {
            body["extra_body"] = json!({
                "image": ref_urls,
            });
        }

        // Optional extra params (num_frames, height, width, etc.)
        if let Some(extra) = &request.extra_params {
            for (key, value) in extra {
                if key == "image" || key == "extra_body" {
                    continue;
                }
                body[key] = value.clone();
            }
        }

        info!(
            "Agnes Video: submitting task to {} with model {}",
            base_url, remote_model_id
        );

        let url = Self::build_create_url(&base_url);
        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AIError::Provider(format!("Agnes Video: request failed: {}", e)))?;

        let status = response.status();
        let response_body: Value = response
            .json()
            .await
            .map_err(|e| AIError::Provider(format!("Agnes Video: failed to parse response: {}", e)))?;

        if !status.is_success() {
            return Err(AIError::Provider(format!(
                "Agnes Video: HTTP {} — {}",
                status, response_body
            )));
        }

        let video_id = parse_create_response(&response_body)?;

        info!("Agnes Video: task created, video_id={}", video_id);

        Ok(ProviderTaskSubmission::Queued(ProviderTaskHandle {
            task_id: video_id.clone(),
            metadata: Some(json!({
                "video_id": video_id,
                "base_url": base_url,
            })),
        }))
    }

    async fn poll_task(
        &self,
        handle: ProviderTaskHandle,
    ) -> Result<ProviderTaskPollResult, AIError> {
        let metadata = handle.metadata.as_ref().ok_or_else(|| {
            AIError::Provider("Agnes Video: poll_task missing metadata".into())
        })?;

        let video_id = metadata
            .get("video_id")
            .and_then(|v| v.as_str())
            .unwrap_or(&handle.task_id);

        let base_url = metadata
            .get("base_url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AIError::Provider("Agnes Video: poll_task missing base_url".into()))?;

        let api_key = self
            .api_key
            .read()
            .await
            .clone()
            .ok_or_else(|| AIError::Provider("Agnes Video: poll_task missing api_key".into()))?;

        let url = Self::build_poll_url(base_url, video_id);

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map_err(|e| AIError::Provider(format!("Agnes Video: poll request failed: {}", e)))?;

        let status = response.status();
        let response_body: Value = response
            .json()
            .await
            .map_err(|e| AIError::Provider(format!("Agnes Video: failed to parse poll response: {}", e)))?;

        if !status.is_success() {
            return Err(AIError::Provider(format!(
                "Agnes Video: poll HTTP {} — {}",
                status, response_body
            )));
        }

        info!(
            "Agnes Video: poll video_id={} status={:?}",
            video_id,
            response_body.get("status").and_then(|v| v.as_str())
        );

        parse_poll_response(&response_body)
    }

    async fn generate(&self, request: GenerateRequest) -> Result<String, AIError> {
        let submitted = self.submit_task(request).await?;
        let handle = match submitted {
            ProviderTaskSubmission::Succeeded(result) => return Ok(result),
            ProviderTaskSubmission::Queued(handle) => handle,
        };
        loop {
            match self.poll_task(handle.clone()).await? {
                ProviderTaskPollResult::Running => {
                    tokio::time::sleep(tokio::time::Duration::from_millis(3000)).await;
                }
                ProviderTaskPollResult::Succeeded(url) => return Ok(url),
                ProviderTaskPollResult::Failed(message) => {
                    return Err(AIError::TaskFailed(message));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn make_request() -> GenerateRequest {
        GenerateRequest {
            prompt: "A cat dancing in the rain".to_string(),
            model: "agnes-video-v2.0".to_string(),
            size: "auto".to_string(),
            aspect_ratio: "16:9".to_string(),
            action: None,
            reference_images: None,
            extra_params: None,
            provider_runtime: Some(RuntimeProviderConfig {
                kind: "custom-provider".into(),
                provider_profile_id: None,
                provider_display_name: None,
                protocol: Some("agnes-video".into()),
                base_url: Some("https://apihub.agnes-ai.com".into()),
                api_key: Some("test-key".into()),
                remote_model_id: Some("agnes-video-v2.0".into()),
            }),
        }
    }

    #[test]
    fn parse_create_response_prefers_video_id() {
        let body = json!({
            "video_id": "video_abc123",
            "task_id": "task_xyz789",
            "status": "queued"
        });
        assert_eq!(parse_create_response(&body).unwrap(), "video_abc123");
    }

    #[test]
    fn parse_create_response_falls_back_to_task_id() {
        let body = json!({
            "task_id": "task_xyz789",
            "status": "queued"
        });
        assert_eq!(parse_create_response(&body).unwrap(), "task_xyz789");
    }

    #[test]
    fn parse_create_response_fails_without_ids() {
        let body = json!({ "status": "queued" });
        assert!(parse_create_response(&body).is_err());
    }

    #[test]
    fn parse_poll_response_completed() {
        let body = json!({
            "status": "completed",
            "video_url": "https://example.com/video.mp4"
        });
        match parse_poll_response(&body).unwrap() {
            ProviderTaskPollResult::Succeeded(url) => {
                assert_eq!(url, "https://example.com/video.mp4");
            }
            _ => panic!("expected Succeeded"),
        }
    }

    #[test]
    fn parse_poll_response_running() {
        let body = json!({
            "status": "in_progress",
            "progress": { "percentage": 50 }
        });
        assert!(matches!(
            parse_poll_response(&body).unwrap(),
            ProviderTaskPollResult::Running
        ));
    }

    #[test]
    fn parse_poll_response_failed() {
        let body = json!({
            "status": "failed",
            "error": "Generation timeout"
        });
        match parse_poll_response(&body).unwrap() {
            ProviderTaskPollResult::Failed(msg) => {
                assert_eq!(msg, "Generation timeout");
            }
            _ => panic!("expected Failed"),
        }
    }

    #[test]
    fn parse_poll_response_completed_without_url_is_error() {
        let body = json!({
            "status": "completed"
        });
        assert!(parse_poll_response(&body).is_err());
    }

    #[test]
    fn collect_reference_urls_empty() {
        let req = make_request();
        assert!(collect_reference_urls(&req).unwrap().is_empty());
    }

    #[test]
    fn collect_reference_urls_valid() {
        let mut req = make_request();
        req.reference_images = Some(vec![
            "https://example.com/img1.jpg".into(),
            "https://example.com/img2.jpg".into(),
        ]);
        let urls = collect_reference_urls(&req).unwrap();
        assert_eq!(urls.len(), 2);
    }

    #[test]
    fn collect_reference_urls_exceeds_limit() {
        let mut req = make_request();
        req.reference_images = Some(
            (0..17)
                .map(|i| format!("https://example.com/img{}.jpg", i))
                .collect(),
        );
        assert!(collect_reference_urls(&req).is_err());
    }

    #[test]
    fn supports_model_matches_video() {
        let provider = AgnesVideoProvider::new();
        assert!(provider.supports_model("agnes-video-v2.0"));
        assert!(provider.supports_model("some-video-model"));
        assert!(!provider.supports_model("agnes-image-2.1-flash"));
    }

    #[test]
    fn build_urls() {
        assert_eq!(
            AgnesVideoProvider::build_create_url("https://apihub.agnes-ai.com"),
            "https://apihub.agnes-ai.com/v1/videos"
        );
        assert_eq!(
            AgnesVideoProvider::build_poll_url("https://apihub.agnes-ai.com", "video_abc"),
            "https://apihub.agnes-ai.com/agnesapi?video_id=video_abc"
        );
    }
}
*** End Patch
