# Storyboard Copilot

基于节点画布的 AI 图片生成与分镜工作台，支持图片上传、分镜生成/编辑等流程。

## 技术栈

- 前端：React + TypeScript + Zustand + `@xyflow/react` + TailwindCSS
- 后端：Tauri 2 + Rust（命令式接口）+ SQLite（`rusqlite`，WAL）
- 关键目标：解耦、可扩展、自动持久化、交互性能优先

## 环境要求

- Node.js 20+
- npm 10+
- Rust stable（含 Cargo）
- Tauri 平台依赖（Windows/macOS）

安装教程见：
- [基础工具安装配置（Windows / macOS）](./docs/development-guides/base-tools-installation.md)

## 快速开始

```bash
npm install
```

前端开发：

```bash
npm run dev
```

Tauri 联调（推荐，用于完整链路验证）：

```bash
npm run tauri dev
```

## 开发检查命令

TypeScript 检查：

```bash
npx tsc --noEmit
```

Rust 检查：

```bash
cd src-tauri && cargo check
```

构建检查：

```bash
npm run build
```

## 项目结构（核心）

- `src/`：前端应用
- `src/features/canvas/`：节点画布核心功能
- `src/features/canvas/models/`：模型与供应商注册
- `src/stores/`：全局状态与持久化策略
- `src/commands/`：前端到 Tauri 命令桥接
- `src-tauri/src/`：Rust 后端与命令实现
- `docs/`：项目技术文档

## 开发文档导航

- [项目开发环境与注意事项](./docs/development-guides/project-development-setup.md)
- [供应商与模型扩展指南](./docs/development-guides/provider-and-model-extension.md)
- [基础工具安装配置（Windows / macOS）](./docs/development-guides/base-tools-installation.md)

## 扩展说明

- 新增供应商/模型前，请先阅读扩展指南文档。
- 当前架构已支持按 `providerId` 管理 API Key，并按模型自动路由到对应 provider。