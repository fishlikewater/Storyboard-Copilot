# 自定义 OpenAPI 兼容供应商与二级模型选择设计

## 1. 背景

当前项目的图片生成能力基于“内置供应商 + 内置模型”的静态注册机制：

- 前端通过 `src/features/canvas/models/providers/*.ts` 与 `src/features/canvas/models/image/**/*.ts` 自动发现供应商与模型。
- 节点生成时按 `selectedModel.providerId` 选择供应商，并通过 `setApiKey(providerId, apiKey)` 将密钥写入对应后端 provider。
- 后端在 `src-tauri/src/ai/providers/mod.rs` 中注册固定 provider，再按模型路由到对应 provider。

这套结构适合固定接入 `KIE / PPIO / FAL / GRSAI`，但不适合下面的新需求：

1. 用户自行新增供应商配置。
2. 每个自定义供应商拥有独立的 `baseUrl / apiKey / 多个模型`。
3. 节点侧改成“供应商 -> 模型”的二级级联选择。
4. 首期支持 `OpenAPI` 兼容协议，后续预留 `xais` 等协议扩展位。

## 2. 目标与非目标

### 2.1 目标

本期目标如下：

1. 保留现有内置供应商与内置模型能力不变。
2. 在设置页新增“自定义供应商”配置区，支持增删改多个供应商实例。
3. 每个自定义供应商实例支持：
   - 自定义名称
   - 自定义 `baseUrl`
   - 自定义 `apiKey`
   - 自定义协议类型
   - 自定义多个模型
4. 节点模型选择改成二级级联：
   - 一级选择供应商
   - 二级选择该供应商下的模型
5. 当选择的是自定义 `OpenAPI` 兼容供应商时，生成请求自动切换到对应协议实现。
6. 文生图与图生图都能按用户提供的 `OpenAPI` 兼容请求格式成功发送与解析返回值。

### 2.2 非目标

本期不做以下内容：

1. 不把现有内置供应商重构成完全配置化供应商。
2. 不接入 `xais` 协议的异步任务与 SSE。
3. 不为 `OpenAPI` 兼容供应商提供真实的分辨率透传。
4. 不改动现有内置模型定价体系。
5. 不在节点弹层内直接编辑供应商配置，供应商编辑仍集中在设置页。

## 3. 用户体验

### 3.1 设置页

设置页 `providers` 分类拆成两段：

1. 内置供应商区
   - 继续展示 `KIE / PPIO / FAL / GRSAI`
   - 保留当前 API Key 配置方式
2. 自定义供应商区
   - 提供“添加供应商”入口
   - 每个自定义供应商以卡片形式展示
   - 支持编辑与删除

每张自定义供应商卡片包含以下字段：

- 供应商名称
- 协议兼容类型，首期仅 `OpenAPI`
- `Base URL`
- `API Key`
- 模型列表

每个模型条目包含：

- 模型显示名
- 远端模型 ID
- 启用开关

### 3.2 节点参数面板

节点模型选择改为二级级联：

1. 一级展示供应商列表
   - 内置供应商
   - 自定义供应商实例
2. 二级展示当前供应商下的模型列表

交互规则：

1. 如果当前供应商没有配置可用密钥，则保持现有“跳转设置页”引导能力。
2. 自定义 `OpenAPI` 供应商选中后，比例仍可选。
3. 自定义 `OpenAPI` 供应商选中后，分辨率控件隐藏或锁定为占位值，不让用户误以为会透传。
4. 模型面板中提供“管理供应商”入口，直接跳到设置页的 `providers` 分类。

## 4. 数据模型设计

### 4.1 设置存储

在 `src/stores/settingsStore.ts` 中新增自定义供应商配置集合，例如：

```ts
type CustomProviderProtocol = 'openapi';

interface CustomProviderModelConfig {
  id: string;
  displayName: string;
  remoteModelId: string;
  enabled: boolean;
}

interface CustomProviderConfig {
  id: string;
  name: string;
  protocol: CustomProviderProtocol;
  baseUrl: string;
  apiKey: string;
  models: CustomProviderModelConfig[];
}
```

新增存储字段：

```ts
customProviders: CustomProviderConfig[];
```

### 4.2 内部模型标识

节点数据中的 `model` 字段继续只保存一个字符串，但对自定义供应商不直接保存远端模型 ID，而是保存稳定的内部模型 ID。

推荐格式：

```text
custom-openapi:<providerProfileId>:<modelEntryId>
```

设计原因：

1. 用户随时可能修改远端模型 ID，节点中的历史引用不能因此失效。
2. 远端模型 ID 可能包含大小写、下划线或未来的特殊命名，不适合作为内部主键。
3. 删除、禁用、迁移时更容易做回退和兼容处理。

### 4.3 运行时请求配置

前端发起生成请求时，为自定义供应商附带运行时配置对象，不再依赖单独的 `setApiKey(providerId, key)`。

推荐增加：

```ts
interface RuntimeProviderConfig {
  kind: 'builtin' | 'custom-openapi';
  providerProfileId?: string;
  providerDisplayName?: string;
  protocol?: 'openapi';
  baseUrl?: string;
  apiKey?: string;
  remoteModelId?: string;
}
```

并在以下结构中新增可选字段：

- `src/features/canvas/application/ports.ts` 中的 `GenerateImagePayload`
- `src/commands/ai.ts` 中的 `GenerateRequest`
- `src-tauri/src/commands/ai.rs` 中的 `GenerateRequestDto`
- `src-tauri/src/ai/mod.rs` 中的 `GenerateRequest`

## 5. 前端架构调整

### 5.1 模型注册层

现有 `src/features/canvas/models/registry.ts` 继续负责静态内置模型发现，但需要补一层“运行时模型清单聚合”：

1. 静态内置模型仍来自 `import.meta.glob`
2. 自定义供应商模型根据 `settingsStore.customProviders` 运行时派生
3. 统一对外暴露：
   - 供应商列表
   - 模型列表
   - 通过模型 ID 解析模型定义
   - 通过模型 ID 解析运行时 provider 配置

推荐新增一组运行时解析函数，例如：

- `listRuntimeModelProviders(settings)`
- `listRuntimeImageModels(settings)`
- `getRuntimeImageModel(modelId, settings)`
- `resolveRuntimeProviderConfig(modelId, settings)`

### 5.2 AI Gateway

`src/features/canvas/infrastructure/tauriAiGateway.ts` 需要调整为：

1. 生成前先判断模型是否属于内置供应商。
2. 内置供应商保持现有逻辑：
   - 必要时继续调用 `setApiKey`
   - 按现有 provider 归一化参考图
3. 自定义 `OpenAPI` 供应商改为：
   - 从设置中解析 `baseUrl / apiKey / remoteModelId`
   - 将运行时 provider 配置一并写入生成请求
   - 参考图统一转成 `data:` URL 或保留现有 `http/https` URL

### 5.3 节点与交互层

`src/features/canvas/ui/ModelParamsControls.tsx` 需要从“单一模型列表带 provider 分组”改为真正的二级级联：

1. 一级：供应商按钮组
2. 二级：当前供应商的模型按钮组
3. 新增“管理供应商”按钮
4. 自定义 `OpenAPI` 模型下隐藏分辨率控制

`ImageEditNode.tsx` 与 `StoryboardGenNode.tsx` 需要统一接入运行时 provider 解析能力，并在发送请求时附带 `providerRuntime`。

## 6. 后端架构调整

### 6.1 路由原则

后端分成两条路由：

1. 内置供应商
   - 继续走当前 `ProviderRegistry`
   - 继续由 `model` 或 `providerId` 解析到固定 provider
2. 自定义 `OpenAPI` 供应商
   - 不进入当前固定 provider 注册列表
   - 由 `commands/ai.rs` 根据 `providerRuntime.kind` 直接路由到新的 OpenAPI 兼容执行器

这样可以避免以下问题：

1. 多个自定义供应商实例共享同一个 provider 名称时，API Key 互相覆盖。
2. 为每个自定义供应商动态注册一个 Rust provider 会让注册表职责变复杂。

### 6.2 OpenAPI 兼容执行器

新增一个独立模块，例如：

- `src-tauri/src/ai/providers/openapi_compat/mod.rs`

职责如下：

1. 接收运行时 `baseUrl / apiKey / remoteModelId`
2. 组装 OpenAPI 兼容请求
3. 解析响应中的图片地址
4. 返回最终图片 URL

该执行器无需进入 `build_default_providers()`，避免与固定 provider 体系耦合。

## 7. OpenAPI 兼容协议映射

### 7.1 文生图

请求地址：

```text
POST {baseUrl}/chat/completions
```

请求头：

```text
Authorization: Bearer {apiKey}
Content-Type: application/json
```

请求体：

```json
{
  "model": "Nano_Banana_Pro_2K_0",
  "messages": [
    {
      "role": "user",
      "content": "夕阳美景，图片长宽比9:16"
    }
  ]
}
```

其中：

1. `model` 使用自定义模型配置中的 `remoteModelId`
2. `content` 使用最终 prompt
3. 最终 prompt 规则为：原始提示词 + 比例提示

### 7.2 图生图

请求地址仍为：

```text
POST {baseUrl}/chat/completions
```

请求体：

```json
{
  "model": "Nano_Banana_Pro_2K_0",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "将这张图改为油画风格，图片长宽比9:16"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,..."
          }
        }
      ]
    }
  ]
}
```

规则：

1. 第一项始终为文本提示。
2. 后续按参考图顺序追加 `image_url` 条目。
3. 支持 `http/https` URL 与 `data:` URL。
4. 如果没有任何可编码参考图，则直接返回请求参数错误。

### 7.3 比例与分辨率策略

对自定义 `OpenAPI` 兼容模型执行以下规则：

1. `aspect_ratio` 不作为独立字段透传，而是拼进提示词。
2. `size / resolution` 本期不透传，前端不暴露真实可调入口。
3. 后端无需为 `OpenAPI` 兼容模型解析 `size` 字段的业务含义，只保留字段以兼容现有调用接口。

### 7.4 返回解析

兼容响应按以下顺序解析：

1. 读取 `choices[0].message.content`
2. 如果内容是字符串，提取第一段 Markdown 图片语法中的 URL：

```text
![image](https://...)
```

3. 若提取成功且 URL 非空，则返回该 URL。
4. 若内容为空、URL 为空、或格式不是预期的 Markdown 图片语法，则返回协议错误，并附带截断后的原始响应摘要。

## 8. 校验与回退策略

### 8.1 设置页校验

自定义供应商保存前校验：

1. `name` 非空
2. `baseUrl` 非空
3. `apiKey` 非空
4. `models` 至少存在一个启用模型
5. 每个模型的 `displayName` 与 `remoteModelId` 非空

### 8.2 节点回退

当节点中保存的自定义模型失效时，回退顺序如下：

1. 回退到同一供应商下第一个启用模型
2. 如果供应商已删除或无启用模型，则回退到 `DEFAULT_IMAGE_MODEL_ID`

### 8.3 错误呈现

自定义供应商请求出错时，错误上下文需至少包含：

1. 供应商名称
2. 协议类型
3. `baseUrl`
4. 远端模型 ID

这样便于区分“网关配置错误”和“模型响应格式不兼容”。

## 9. 迁移方案

### 9.1 设置存储迁移

在 `settingsStore` 的 `persist.migrate` 中：

1. 新增 `customProviders` 字段，旧版本默认迁移为空数组。
2. 内置供应商继续使用现有 `apiKeys`。
3. 自定义供应商的 `apiKey` 存在 `customProviders[].apiKey` 中，不混入 `apiKeys`。

### 9.2 历史节点兼容

1. 历史内置模型 ID 完全保持不变。
2. 本期新增的自定义模型内部 ID 只用于新增配置，不涉及旧数据迁移。
3. 将来若用户修改远端模型 ID，不需要改动历史节点中的内部模型 ID。

## 10. 验证方案

### 10.1 功能验证

至少验证以下场景：

1. 设置页可以新增一个自定义 `OpenAPI` 供应商。
2. 一个自定义供应商下可以新增多个模型。
3. 节点里可以先选供应商，再选模型。
4. 选择自定义 `OpenAPI` 模型后，比例可选，分辨率隐藏或锁定。
5. 文生图请求可以按 `model + messages` 结构成功发出。
6. 图生图请求可以按 `content: [text, image_url]` 结构成功发出。
7. 返回的 `![image](url)` 能正确提取出图片 URL。

### 10.2 工程验证

本期改动完成后执行：

```bash
npx tsc --noEmit
cd src-tauri && cargo check
```

如改动影响构建链路，再补充：

```bash
npm run build
```

## 11. 风险与后续扩展

### 11.1 已知风险

1. 不同 OpenAPI 兼容网关对图片输入的兼容程度可能不同。
2. 部分网关可能不接受 `data:` URL，只接受公网 URL。
3. 部分网关可能返回的不是标准 Markdown 图片格式，需要后续补解析策略。

### 11.2 后续扩展位

协议枚举保留为可扩展结构，下一阶段可在不推翻本设计的前提下新增：

1. `xais` 协议
2. 异步任务与 SSE 进度追踪
3. 自定义协议专属额外参数面板

## 12. 实施建议

建议按以下顺序实施：

1. 先完成设置存储与设置页配置结构。
2. 再完成运行时模型聚合与节点二级级联 UI。
3. 然后补前端请求携带 `providerRuntime`。
4. 最后实现 Rust 侧 `OpenAPI` 兼容执行器并完成联调验证。

这样可以保证每一层都沿现有数据流递进修改，避免跨层硬编码。
