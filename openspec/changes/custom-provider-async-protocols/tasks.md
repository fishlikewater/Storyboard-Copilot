## 1. 配置模型与旧数据迁移

- [ ] 1.1 将 `customProviderConfig` 从平铺 `openapi` 结构升级为“协议 + connection 分组”结构
- [ ] 1.2 为 `settingsStore` 补充旧版 `baseUrl/apiKey` 到 `connection.openapi` 的迁移逻辑
- [ ] 1.3 更新并通过 `customProviderConfig` 相关测试，覆盖 `openapi` 迁移、`xais-task` 标准化与协议字段校验

## 2. 运行时模型与生成上下文升级

- [ ] 2.1 将运行时 provider 类型统一为 `custom-provider`，扩展 `openapi` 与 `xais-task` 协议字段
- [ ] 2.2 更新 `runtimeRegistry` 与 `runtimeGenerationContext`，让不同协议都能生成正确的 `providerRuntime`
- [ ] 2.3 更新运行时相关前端测试，覆盖 `openapi` 与 `xais-task` 的 provider/model 输出与配置完整性

## 3. 供应商编辑器与供应商页面升级

- [ ] 3.1 改造 `CustomProviderEditorDialog`，支持按接入协议切换连接字段，并让模型列表在固定尺寸弹窗内滚动
- [ ] 3.2 更新供应商管理页与相关 i18n，确保新增/编辑/保存体验符合新协议结构
- [ ] 3.3 更新前端测试，覆盖协议字段切换、内部滚动容器与保存行为

## 4. 后端协议执行器与任务路由

- [ ] 4.1 扩展 Tauri 侧 `RuntimeProviderConfig`，加入 `submitBaseUrl`、`waitBaseUrl`、`assetBaseUrl`、`outputFormat`
- [ ] 4.2 新增 `xais_task` 协议执行器，支持 `workerTaskStart`、`workerTaskWait?json=true` 和稳定资源地址转换
- [ ] 4.3 调整 `commands/ai.rs`，对自定义供应商按 `protocol` 分流，并将 `xais-task` 接入可恢复任务框架
- [ ] 4.4 更新 Rust 测试，覆盖 Xais 请求映射、轮询解析、资源地址转换与同步 `openapi` 失败语义

## 5. 前端接线、回归验证与手工联调

- [ ] 5.1 更新 `src/commands/ai.ts`、节点生成 payload 与相关测试，确保前端完整透传新的 `providerRuntime`
- [ ] 5.2 更新生图节点与模型参数测试，确认自定义供应商仍参与供应商/模型级联选择
- [ ] 5.3 运行定向 Vitest、`npx tsc --noEmit`、`cargo test`、`cargo check` 与 `npm run build`
- [ ] 5.4 执行一轮手工 Tauri 联调，验证 `openapi` 不回归、`xais-task` 长耗时任务可恢复、供应商弹窗不再被模型列表撑开
