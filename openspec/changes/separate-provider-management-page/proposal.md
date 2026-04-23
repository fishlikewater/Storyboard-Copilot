## Why

当前自定义供应商管理被内嵌在设置页的 `providers` 分类中，并与内置供应商的 API Key 配置混在一起。随着 OpenAPI 自定义供应商与多模型配置已经可用，原有长表单编辑方式不便于快速浏览、补充和维护多个供应商，因此需要将“自定义供应商管理”抽成独立入口，同时保持已有生图选择与运行时切换逻辑不回归。

## What Changes

- 在设置页左侧新增独立菜单项，菜单名称为“供应商”，专门承载自定义供应商管理。
- 将现有内嵌式自定义供应商表单改造为“列表页 + 弹窗编辑”模式。
- 供应商页面顶部展示“添加供应商”按钮，列表区展示已添加的自定义供应商。
- 每条供应商列表行展示供应商名称、可用模型名称摘要，以及“编辑”按钮。
- 点击“添加供应商”时弹出新增窗口，沿用当前自定义供应商所需字段：供应商名称、协议、Base URL、密钥、模型列表、模型启用状态、模型 ID 等。
- 点击列表中的“编辑”按钮时弹出编辑窗口，表单结构与新增窗口保持一致，并支持保存更新后的供应商信息。
- 保持 `customProviders` 的存储结构与运行时注册逻辑兼容，确保新增或编辑后的自定义供应商仍然出现在生图时的供应商/模型选择中。
- 将现有 `providers` 分类收敛为内置供应商 API Key 与说明文档入口，避免在左侧出现两个职责冲突的“供应商”入口。

## Capabilities

### New Capabilities
- `custom-provider-management`: 在设置页中提供独立的自定义供应商列表、添加弹窗、编辑弹窗，以及保存后可用于生图选择的完整管理能力

### Modified Capabilities
- 无

## Impact

- 前端设置页结构：`src/components/SettingsDialog.tsx`
- 自定义供应商管理组件拆分：`src/components/settings/**`
- 设置分类事件与路由：`src/features/settings/settingsEvents.ts`
- 自定义供应商持久化与校验：`src/stores/customProviderConfig.ts`、`src/stores/settingsStore.ts`
- 生图侧入口跳转与可用性保持：`src/features/canvas/ui/ModelParamsControls.tsx`
- 多语言文案：`src/i18n/locales/zh.json`、`src/i18n/locales/en.json`
