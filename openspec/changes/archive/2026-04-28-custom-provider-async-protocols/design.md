## Context

当前项目已经有完整的生成任务外壳：前端通过 `submitGenerateImageJob` 发起任务，`Canvas` 中通过 `getGenerateImageJob` 轮询状态，后端用 `ai_generation_jobs` 记录任务并支持可恢复与不可恢复两类执行模式。问题不在任务框架，而在自定义供应商仍被硬编码为 `custom-openapi`，既限制了协议扩展，也让长耗时请求只能走一次同步 HTTP 调用。

供应商管理侧目前已经独立成设置页中的“供应商”分类，但 `CustomProviderEditorDialog` 仍然只支持平铺的 `openapi` 配置结构，且模型列表没有内部滚动，模型数量增加后会把整个弹窗撑开。用户已经确认本次目标不是简单优化报错提示，而是要把长耗时生成提升为通用的异步任务接入能力。

## Goals / Non-Goals

**Goals:**
- 将自定义供应商配置升级为可扩展的“接入协议”结构。
- 保留 `openapi` 的同步兼容模式，同时新增 `xais-task` 异步任务协议。
- 让 `xais-task` 复用现有任务框架，实现提交后可恢复、重启后可继续轮询的行为。
- 修复供应商编辑弹窗布局，让模型列表在固定壳体内滚动。
- 保持自定义供应商仍能参与节点侧的供应商/模型选择。

**Non-Goals:**
- 不改造内置 provider 的注册表与运行时模型结构。
- 不在本次接入视频任务的完整运行时参数与 UI。
- 不把 `attUrls` 返回的签名下载地址持久化为长期图片地址。
- 不为 `openapi` 同步协议引入自动重试。

## Decisions

### 1. 统一自定义供应商运行时类型为 `custom-provider`

不再把协议直接编码进 `RuntimeProviderConfig.kind`。`kind` 只区分“内置 / 自定义”，真正的执行分流由 `protocol` 决定。

选择这个方案的原因：
- 可以在不继续膨胀 `kind` 枚举的情况下接入新协议。
- 节点、前端 DTO、Tauri 命令层只需记住一套自定义 provider 路径。
- `openapi` 和 `xais-task` 可以共享供应商与模型聚合逻辑。

备选方案：
- 继续沿用 `custom-openapi` 并额外加 `custom-xais-task`：被否决，因为会让运行时类型和协议枚举重复表达同一件事。

### 2. 自定义供应商配置改为“公共字段 + connection 分组”

将旧版顶层 `baseUrl/apiKey` 迁移为 `connection.openapi`，并为 `xais-task` 新增 `connection.xaisTask`：
- `submitBaseUrl`
- `waitBaseUrl`
- `assetBaseUrl`
- `apiKey`
- `defaultOutputFormat`

这样做的原因：
- 用户提供的 Xais 样例中提交、等待和资源下载使用了不同 host，不能假设单一 `baseUrl`。
- 协议字段分组后，供应商弹窗可以按 `protocol` 切换字段区，避免所有字段平铺在一起。

### 3. `xais-task` 直接对接现有可恢复任务框架

`submit_generate_image_job` 在识别到 `protocol = xais-task` 后，只负责：
- 生成 `job_id`
- 调用 `workerTaskStart`
- 存储 `external_task_id`
- 把提交时需要的元数据写入 `external_task_meta_json`

`get_generate_image_job` 则继续读取相同的 `job_id`，并通过协议执行器轮询 `workerTaskWait?id=<taskId>&json=true`。

选择这个方案的原因：
- 不需要额外发明第二套轮询框架。
- 应用重启后仍能继续追踪同一个远端任务。
- 与现有内置可恢复 provider 的语义保持一致。

备选方案：
- 在前端直接轮询 Xais API：被否决，因为会把密钥与协议细节泄漏到前端，并绕过现有任务表。
- 对 `workerTaskWait` 使用常驻 SSE：首版被否决，因为 `json=true` 已足够复用现有 `poll_task()` 接口，而且更易恢复。

### 4. Xais 成功结果只持久化稳定资源地址

`workerTaskWait?json=true` 成功后返回的是图片 key。本次不调用 `attUrls` 把签名 URL 持久化，而是拼接稳定地址：

`{assetBaseUrl}/xais/img?att=<imageKey>`

这样做的原因：
- `attUrls` 返回的签名地址会过期。
- 项目重开后需要继续显示图片，稳定资源地址比签名 URL 更可靠。

### 5. 供应商编辑器采用固定尺寸壳体与内部滚动模型区

编辑弹窗保持固定高宽基准，并将模型列表放入单独的 `overflow-y-auto` 容器。协议字段区域与模型区域分层组织：
- 公共字段
- 协议字段
- 模型列表

这样做的原因：
- 解决当前模型越多弹窗越被撑开的实际 bug。
- 保证底部“保存 / 取消”始终固定可见。
- 为后续继续扩协议字段预留稳定的视觉骨架。

## Risks / Trade-offs

- [自定义供应商配置结构变化会影响持久化兼容] → 在 `normalizeCustomProviders` 和 `settingsStore.persist.migrate` 中兼容旧的 `baseUrl/apiKey` 顶层字段。
- [Xais 的 `workerTaskWait?json=true` 可能表现为长轮询而非立即返回状态] → 单次超时或单次 `524` 先视为“仍在运行”，不要直接落失败；由连续错误阈值决定最终失败。
- [将成功结果转为稳定资源地址可能依赖服务端长期保证该地址可用] → `assetBaseUrl` 暴露为供应商配置项，后续如需改为 `attUrls` 也可以在协议层单独调整。
- [协议字段增多后表单复杂度上升] → 用按 `protocol` 切换字段区控制一次只展示当前协议所需字段。

## Migration Plan

1. 升级 `CustomProviderConfig` 与 `settingsStore` 迁移逻辑，把旧版 `openapi` 供应商平滑迁移到 `connection.openapi`。
2. 调整运行时模型注册与生成上下文，使节点、DTO、Tauri 命令都接受新的 `custom-provider` 结构。
3. 完成供应商编辑器 UI 调整，并验证旧供应商在新弹窗中仍可正常编辑与保存。
4. 在 Rust 侧接入 `xais-task` 协议执行器，将其纳入现有 `ai_generation_jobs` 轮询路径。
5. 验证 `openapi` 供应商不回归，`xais-task` 可恢复任务行为符合预期。

回滚策略：
- 若协议层改造出现问题，可保留新的供应商配置结构但暂时只支持 `openapi` 路由，不需要回滚用户数据。
- 若 `xais-task` 路由出现异常，可只回退命令层协议分流，让 `openapi` 路径继续工作。

## Open Questions

- 无。用户已经确认本次 `xais-task` 首版只覆盖图片生成 / 图生图，不包含视频参数与完整视频链路。
