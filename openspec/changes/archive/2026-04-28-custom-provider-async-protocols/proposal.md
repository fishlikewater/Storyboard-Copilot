## Why

当前自定义供应商虽然已经支持 `openapi` 兼容接入，但底层仍然是同步 `POST /chat/completions`，长耗时生成时会直接暴露为 `524` 或超时失败，而且无法继续等待同一任务结果。同时，供应商编辑弹窗在模型较多时会被整体撑开，影响可用性。现在需要把自定义供应商提升为“按接入协议驱动”的统一结构，一次性解决协议扩展、异步任务恢复和供应商编辑体验问题。

## What Changes

- 将自定义供应商的“协议兼容”统一命名为“接入协议”，并把配置结构升级为“供应商公共信息 + 协议连接配置 + 模型列表”。
- 保留现有 `openapi` 自定义供应商能力，并兼容旧版 `baseUrl/apiKey` 平铺配置的自动迁移。
- 新增 `xais-task` 接入协议，支持 `workerTaskStart`、`workerTaskWait?json=true` 和图片 key 到稳定资源地址的解析。
- 让自定义供应商运行时统一输出 `custom-provider` 类型的 `providerRuntime`，由后端按 `protocol` 分发到不同协议执行器。
- 复用现有 `ai_generation_jobs` 任务框架，把 `xais-task` 生成接入为可恢复任务，避免长耗时任务因单次网络波动被重新生成。
- 修复供应商编辑弹窗：采用固定尺寸壳体、内部滚动模型列表、按协议切换字段区。
- 保持自定义供应商仍然参与生图节点中的供应商/模型二级级联选择。

## Capabilities

### New Capabilities
- `custom-provider-generation-protocols`: 为自定义供应商提供按接入协议分流的生成运行时，包括同步 `openapi` 与可恢复的 `xais-task` 协议

### Modified Capabilities
- `custom-provider-management`: 扩展供应商编辑器以支持接入协议字段分组、`xais-task` 连接配置，以及固定尺寸与内部滚动的编辑体验

## Impact

- 前端自定义供应商配置与持久化：`src/stores/customProviderConfig.ts`、`src/stores/settingsStore.ts`
- 运行时模型聚合与生成上下文：`src/features/canvas/models/**`、`src/features/canvas/application/runtimeGenerationContext.ts`
- 供应商管理 UI：`src/components/settings/**`、`src/components/SettingsDialog.tsx`
- 前端 Tauri DTO 与节点接线：`src/commands/ai.ts`、`src/features/canvas/application/buildNodeGeneratePayload.ts`、`src/features/canvas/nodes/*.tsx`
- Tauri 协议执行器与任务路由：`src-tauri/src/ai/**`、`src-tauri/src/commands/ai.rs`
