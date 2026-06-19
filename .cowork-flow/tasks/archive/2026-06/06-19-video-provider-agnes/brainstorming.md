# Brainstorming：视频供应商接入

## 目标

在设置页面新增「视频供应商」管理入口，初始接入 Agnes Video V2.0，后端实现异步视频生成 provider。

## 非目标

- 视频播放节点、画布集成、视频预览 UI
- 除 Agnes 以外的其他视频供应商协议
- 从画布触发视频生成的完整调用链

## 关键假设

1. Agnes Video API 使用 Bearer Token 鉴权，与 Agnes Image 一致，可复用现有 RuntimeProviderConfig 模式
2. 视频生成结果是 URL（非 base64），后续画布集成时需单独处理，本次只确保 provider 能返回 URL
3. 前端视频供应商配置与图片供应商配置完全隔离，各自独立的 store 和 UI，避免类型污染
4. 视频协议下拉当前仅 agnes-video，但架构预留扩展能力

## 推荐方案

独立视频供应商系统（方案 A）。创建独立的 VideoProviderConfig 类型和 UI 组件，与图片供应商完全平行。类型隔离、改动范围清晰、不影响现有图片功能。

被拒方案：扩展 CustomProviderConfig 增加 mediaType（方案 B），因类型污染风险被拒。

## 验收标准

1. 设置侧栏显示「视频供应商」，点击进入列表页
2. 可添加/编辑/删除视频供应商，协议下拉有 Agnes Video
3. 选择 Agnes Video 后自动填充基地址 https://apihub.agnes-ai.com
4. 填写 API Key + 模型 ID 后可保存，持久化到 localStorage
5. agnes_video provider 的 submit_task 能创建视频任务
6. poll_task 能查询状态，返回 Running/Succeeded/Failed
7. 现有图片供应商不受影响
8. 中英文翻译完整
9. cargo test 通过
10. TypeScript 编译通过
*** End Patch
