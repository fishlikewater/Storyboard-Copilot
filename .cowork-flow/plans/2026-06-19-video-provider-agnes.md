# Video Provider Agnes Implementation Plan

> For formal fixed-agent work: create a runtime context with `.cowork-flow/run subagent init`, pass `cowork_runtime_context_id: <runtime_context_id>` through the active Host Adapter, then dispatch `cowork-implement` or `cowork-check`. Close the runtime context after verification.

**Goal:** 在设置页面新增视频供应商管理入口，后端实现 Agnes Video V2.0 异步生成 provider。
**Architecture:** 独立视频供应商系统（VideoProviderConfig + VideoProvidersPage），与图片供应商完全平行。后端新增 `agnes_video` provider 模块，复用 `AIProvider` trait 的 submit_task/poll_task 异步模式。
**Verification:** `cargo test`、`npx tsc --noEmit`、设置页面手动验证。
**Execution Strategy:** Serial work — slice 1 (Rust) → slice 2 (frontend store) → slice 3 (frontend UI) → slice 4 (integration)。

---

## Slice 1: Rust 后端 — Agnes Video Provider

### 步骤 1.1: 创建 agnes_video provider 模块

- **文件**: `src-tauri/src/ai/providers/agnes_video/mod.rs`（新建）
- **内容**:
  - `AgnesVideoProvider` struct，持有 `Client` 和 `api_key: Arc<RwLock<Option<String>>>`
  - `trim()` / `validate_runtime()` 辅助函数（与 agnes/mod.rs 一致）
  - `collect_reference_images()` 解析 reference_images 为 URL 列表
  - `parse_video_response()` 解析创建任务响应，提取 video_id 和 task_id
  - `parse_poll_response()` 解析轮询响应，提取 status 和 video_url
  - 实现 `AIProvider` trait:
    - `name()` → `"agnes_video"`
    - `supports_model(model)` → model 包含 `"video"` 或以 `"agnes-video"` 开头
    - `list_models()` → `["agnes-video-v2.0"]`
    - `submit_task(request)` → POST `{base_url}/v1/videos`，Body: `{"model": remote_model_id, "prompt": prompt, ...}`，返回 `Queued(ProviderTaskHandle { task_id: video_id, metadata: Some(json!({"task_id": task_id})) })`
    - `poll_task(handle)` → GET `{base_url}/agnesapi?video_id={task_id}`，解析 status:
      - `"completed"` → `Succeeded(video_url)`
      - `"failed"` → `Failed(error_message)`
      - 其他 → `Running`
  - 单元测试:
    - `test_parse_video_response` — 验证 video_id 提取
    - `test_parse_poll_response_completed` — 验证 completed 状态解析
    - `test_parse_poll_response_running` — 验证 running 状态解析
    - `test_parse_poll_response_failed` — 验证 failed 状态解析
    - `test_collect_reference_images_valid` — 验证图片 URL 收集
    - `test_collect_reference_images_empty` — 验证空引用图片
    - `test_collect_reference_images_exceeds_limit` — 验证超限拒绝

### 步骤 1.2: 注册 agnes_video provider

- **文件**: `src-tauri/src/ai/providers/mod.rs`（修改）
- **改动**:
  - `pub mod agnes_video;`
  - `pub use agnes_video::AgnesVideoProvider;`
  - `build_default_providers()` 中添加 `Arc::new(AgnesVideoProvider::new())`

### 步骤 1.3: 验证

- **命令**: `cd src-tauri && cargo test`
- **预期**: 所有现有测试通过 + agnes_video 新测试通过

---

## Slice 2: 前端 Store — VideoProviderConfig

### 步骤 2.1: 创建 videoProviderConfig store

- **文件**: `src/stores/videoProviderConfig.ts`（新建）
- **内容**:
  - `VideoProviderProtocol = 'agnes-video'`
  - `VideoProviderModelConfig` 接口（id, displayName, remoteModelId, enabled）
  - `VideoProviderConfig` 接口（id, name, protocol, baseUrl, apiKey, models[]）
  - `createVideoProviderDraft()` — 创建预填 Agnes Video 的草稿
  - `createVideoProviderModelDraft()` — 创建模型草稿
  - `normalizeVideoProviders()` — 归一化配置
  - `validateVideoProviders()` — 校验配置
  - `resolveVideoProviderConnection()` — 提取连接信息

### 步骤 2.2: 在 settingsStore 中添加 videoProviders

- **文件**: `src/stores/settingsStore.ts`（修改）
- **改动**:
  - import `VideoProviderConfig` 和相关函数
  - `SettingsState` 新增 `videoProviders: VideoProviderConfig[]`
  - 新增 `setVideoProviders` action
  - persist 配置中添加 `videoProviders` 的迁移逻辑

### 步骤 2.3: 验证

- **命令**: `npx tsc --noEmit`
- **预期**: 类型检查通过

---

## Slice 3: 前端 UI — VideoProvidersPage + EditorDialog

### 步骤 3.1: 创建 VideoProvidersPage

- **文件**: `src/components/settings/VideoProvidersPage.tsx`（新建）
- **内容**: 复用 `CustomProvidersPage` 的布局模式，协议显示为「Agnes Video」

### 步骤 3.2: 创建 VideoProviderEditorDialog

- **文件**: `src/components/settings/VideoProviderEditorDialog.tsx`（新建）
- **内容**: 复用 `CustomProviderEditorDialog` 的布局，协议下拉仅 `agnes-video`，选中后自动填充基地址

### 步骤 3.3: 添加 i18n 翻译

- **文件**: `src/i18n/locales/zh.json`（修改）
- **文件**: `src/i18n/locales/en.json`（修改）
- **内容**: 添加 videoProvider 相关翻译键

### 步骤 3.4: 验证

- **命令**: `npx tsc --noEmit`
- **预期**: 类型检查通过

---

## Slice 4: SettingsDialog 集成

### 步骤 4.1: 更新 SettingsCategory

- **文件**: `src/features/settings/settingsEvents.ts`（修改）
- **改动**: `SettingsCategory` 新增 `'videoProviders'`

### 步骤 4.2: 更新 SettingsDialog

- **文件**: `src/components/SettingsDialog.tsx`（修改）
- **改动**:
  - import `VideoProvidersPage` 和 `VideoProviderEditorDialog`
  - import `videoProviderConfig` 相关函数
  - 侧栏新增「视频供应商」按钮
  - 内容区渲染 `VideoProvidersPage`
  - 新增 video provider 编辑/删除对话框状态和处理函数
  - `handleSave` 中同步 `videoProviders` 到 store

### 步骤 4.3: 最终验证

- **命令**: `npx tsc --noEmit && cd src-tauri && cargo test`
- **预期**: 前后端编译/测试全部通过

---

## 风险

- Agnes Video API 可能有频率限制或需要特定权限，需用户自行确保 API Key 有效。
- 视频生成结果是 URL 而非 base64，后续画布集成时需要不同的处理逻辑（本次不涉及）。
- 现有图片供应商配置迁移时需确保不丢失数据。
*** End Patch
