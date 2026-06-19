# PRD：设置页面接入视频供应商（Agnes Video V2.0）

## 背景

mirage-studio 当前已接入多个 AI 图片生成供应商（PPIO、Grsai、Kie、Fal、Agnes Images），使用 `AIProvider` trait 的 `submit_task` / `poll_task` 异步任务模式。用户现在需要在设置页面增加「视频供应商」入口，允许添加和管理视频生成供应商，初始支持 Agnes Video V2.0。

## 目标

1. 在设置页面新增「视频供应商」分类，与现有「供应商」（图片）平级。
2. 视频供应商的添加/编辑/删除流程与图片供应商一致（选协议 → 填连接信息 → 配模型）。
3. 下拉列表默认提供 Agnes Video 供应商选项，基地址 `https://apihub.agnes-ai.com`，模型 `agnes-video-v2.0`。
4. 后端新增 `agnes_video` provider，实现 `submit_task` / `poll_task`，调用 Agnes Video V2.0 异步 API。
5. 视频供应商配置持久化到 settings store，与图片供应商配置隔离。

## Agnes Video V2.0 API 要点

- **创建任务**：`POST {base_url}/v1/videos`，Header `Authorization: Bearer {api_key}`，Body 含 `model`、`prompt`、可选 `image`（图生视频 URL）、`num_frames`、`height`、`width` 等。
- **查询状态**：`GET {base_url}/agnesapi?video_id={video_id}`，返回 `status`（queued / in_progress / completed / failed）、`video_url`（completed 时可用）。
- 模型名：`agnes-video-v2.0`
- 异步模式天然匹配现有 `ProviderTaskSubmission::Queued` + `ProviderTaskPollResult` 架构。

## 范围边界

### 包含

- Rust 后端：`agnes_video` provider 模块（submit_task / poll_task）。
- 前端 store：`videoProviderConfig.ts`（类型、归一化、校验）。
- 前端 UI：`VideoProvidersPage` + `VideoProviderEditorDialog`，复用现有图片供应商的 UI 模式。
- `SettingsCategory` 新增 `'videoProviders'`。
- i18n 中英文翻译。
- SettingsDialog 侧栏集成。

### 不包含

- 视频播放节点、画布集成、视频预览 UI。
- 除 Agnes 以外的其他视频供应商协议。
- 视频生成的调用链路（从画布触发生成）。

## 验收标准

1. 设置侧栏显示「视频供应商」入口，点击进入列表页。
2. 列表页可添加/编辑/删除视频供应商，编辑对话框中协议下拉有 Agnes Video 选项。
3. 选择 Agnes Video 后自动填充默认基地址 `https://apihub.agnes-ai.com`。
4. 填写 API Key 和模型 ID 后可保存，配置持久化到 localStorage（通过 zustand persist）。
5. Rust 端 `agnes_video` provider 的 `submit_task` 能向 Agnes API 创建视频任务并返回 `ProviderTaskSubmission::Queued`。
6. `poll_task` 能查询视频任务状态，返回 `Running` / `Succeeded(video_url)` / `Failed(msg)`。
7. 现有图片供应商功能不受影响。
8. 中英文翻译完整。
9. `cargo test` 通过（含 agnes_video 单元测试）。
10. 前端 TypeScript 编译通过。

## 实现方案

### 后端（Rust）

新增 `src-tauri/src/ai/providers/agnes_video/mod.rs`：

- `AgnesVideoProvider` struct，持有 `Client` 和 `api_key: Arc<RwLock<Option<String>>>`。
- 实现 `AIProvider` trait：
  - `name()` → `"agnes_video"`
  - `supports_model()` → 检查 model 是否包含 `video` 或以 `agnes-video` 开头
  - `submit_task()` → POST `{base_url}/v1/videos`，返回 `Queued(ProviderTaskHandle { task_id: video_id, metadata: Some(json!({"task_id": task_id, "status_url": status_url})) })`
  - `poll_task()` → GET `{base_url}/agnesapi?video_id={task_id}`，解析 status 返回 Running/Succeeded/Failed
  - `list_models()` → `["agnes-video-v2.0"]`
- 在 `providers/mod.rs` 的 `build_default_providers()` 中注册。

### 前端

1. `src/stores/videoProviderConfig.ts`：
   - `VideoProviderProtocol = 'agnes-video'`
   - `VideoProviderConfig` 类型（id, name, protocol, baseUrl, apiKey, models[]）
   - `createVideoProviderDraft()`、`normalizeVideoProviders()`、`validateVideoProviders()`
   - `resolveVideoProviderConnection()` 提取连接信息

2. `src/stores/settingsStore.ts`：
   - 新增 `videoProviders: VideoProviderConfig[]` state 和 `setVideoProviders` action。

3. `src/components/settings/VideoProvidersPage.tsx`：
   - 复用 `CustomProvidersPage` 的布局和交互模式。
   - 协议显示为「Agnes Video」。

4. `src/components/settings/VideoProviderEditorDialog.tsx`：
   - 协议下拉当前仅 `agnes-video`。
   - 选择后自动填充基地址。
   - 模型列表预填 `agnes-video-v2.0`。

5. `src/features/settings/settingsEvents.ts`：
   - `SettingsCategory` 新增 `'videoProviders'`。

6. `src/components/SettingsDialog.tsx`：
   - 侧栏新增「视频供应商」按钮。
   - 内容区渲染 `VideoProvidersPage` + 编辑对话框。

7. i18n：`zh.json` 和 `en.json` 新增视频供应商相关翻译键。

## 风险

- Agnes Video API 可能有频率限制或需要特定权限，需用户自行确保 API Key 有效。
- 视频生成结果是 URL 而非 base64，后续画布集成时需要不同的处理逻辑（本次不涉及）。
*** End Patch
