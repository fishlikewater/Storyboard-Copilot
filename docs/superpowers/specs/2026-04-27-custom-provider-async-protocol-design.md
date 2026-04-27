# 自定义供应商异步接入协议与供应商管理修复设计

## 1. 背景

当前项目已经具备通用的图片生成任务框架：

- 前端通过 `submitGenerateImageJob` 提交生成任务。
- 画布通过 `getGenerateImageJob` 轮询任务状态。
- 后端通过 `ai_generation_jobs` 记录任务，并区分可恢复与不可恢复任务。

但当前自定义供应商仍存在两个明显问题：

1. 供应商编辑弹窗未限制高度，模型列表增多后会把弹窗整体撑大，而不是内部滚动。
2. 自定义 `openapi` 供应商底层仍然是单次同步 `POST /chat/completions`，长耗时场景下容易触发 `524`，且失败后无法继续等待同一任务结果。

用户希望本次变更同时解决：

- 供应商管理页与编辑弹窗的可用性问题。
- 长耗时生成的协议层问题。
- 自定义供应商的“接入协议”能力抽象，为后续接入更多第三方协议预留扩展位。

## 2. 目标与非目标

### 2.1 目标

本次变更目标如下：

1. 将自定义供应商的“协议兼容”命名统一为“接入协议”。
2. 重构自定义供应商配置结构，使其能够承载多种协议。
3. 保持现有 `openapi` 自定义供应商可继续使用。
4. 新增 `xais-task` 异步任务协议，用于解决长耗时生成触发 `524` 的问题。
5. 保持现有前端生成任务交互不变，继续复用 `submitGenerateImageJob / getGenerateImageJob`。
6. 修复供应商编辑弹窗被模型列表撑开的布局问题。
7. 保持自定义供应商依然能出现在生图节点的供应商/模型选择中。

### 2.2 非目标

本次不包含以下内容：

1. 不改造内置供应商的注册方式与请求协议。
2. 不在本次接入视频任务的完整运行时逻辑。
3. 不为 `openapi` 模式引入自动重试。
4. 不在本次持久化签名下载地址作为长期图片地址。
5. 不在节点面板中直接编辑供应商配置，供应商配置仍集中在设置页。

## 3. 设计结论

### 3.1 推荐方案

采用“自定义供应商 + 接入协议层”的统一设计。

核心思路如下：

1. 供应商是用户可维护的配置实体。
2. 协议决定请求映射、任务恢复能力与结果解析方式。
3. 前端节点仍只选择“供应商 + 模型”，不直接关心协议细节。
4. 后端基于运行时协议配置路由到对应协议执行器。

该方案可以同时满足：

- `openapi` 同步协议继续可用。
- `xais-task` 异步任务协议可复用现有任务轮询基础设施。
- 后续新增其它协议时无需再围绕某一家供应商写特判。

## 4. 配置模型设计

### 4.1 自定义供应商配置

将现有 `CustomProviderConfig` 从“平铺连接字段”升级为“公共字段 + 协议连接字段 + 模型列表”：

```ts
export type CustomProviderProtocol = 'openapi' | 'xais-task';

export interface CustomProviderModelConfig {
  id: string;
  displayName: string;
  remoteModelId: string;
  enabled: boolean;
}

export interface OpenApiConnectionConfig {
  baseUrl: string;
  apiKey: string;
}

export interface XaisTaskConnectionConfig {
  submitBaseUrl: string;
  waitBaseUrl: string;
  assetBaseUrl: string;
  apiKey: string;
  defaultOutputFormat?: 'image/png' | 'image/jpeg';
}

export interface CustomProviderConfig {
  id: string;
  name: string;
  protocol: CustomProviderProtocol;
  connection: {
    openapi?: OpenApiConnectionConfig;
    xaisTask?: XaisTaskConnectionConfig;
  };
  models: CustomProviderModelConfig[];
}
```

设计要点：

1. `name` 与 `models` 属于供应商通用配置。
2. 连接信息放入 `connection` 下，避免顶层字段随着协议增多不断膨胀。
3. `xais-task` 单独支持三段 URL：
   - `submitBaseUrl`
   - `waitBaseUrl`
   - `assetBaseUrl`
4. `assetBaseUrl` 独立配置是为了兼容用户提供的 `svt1.dchai.cn` 资源地址。

### 4.2 旧数据迁移

对已保存的旧版自定义供应商做自动迁移：

1. 旧版 `protocol` 缺失时，默认迁移为 `openapi`。
2. 旧版顶层 `baseUrl`、`apiKey` 自动迁移到 `connection.openapi`。
3. 旧版模型列表保持不变。
4. 迁移后写回新结构，用户无需手动重配已存在的 `openapi` 供应商。

## 5. 运行时模型设计

### 5.1 运行时供应商类型

将运行时供应商从现有的 `custom-openapi` 扩展为统一的 `custom-provider`：

```ts
export interface RuntimeProviderConfig {
  kind: 'builtin' | 'custom-provider';
  providerProfileId?: string;
  providerDisplayName?: string;
  protocol?: 'openapi' | 'xais-task';
  apiKey?: string;
  remoteModelId?: string;
  baseUrl?: string;
  submitBaseUrl?: string;
  waitBaseUrl?: string;
  assetBaseUrl?: string;
  outputFormat?: 'image/png' | 'image/jpeg';
}
```

设计要点：

1. `kind` 只区分内置与自定义，不再把协议耦合进 `kind`。
2. `protocol` 才是真正的路由键。
3. `remoteModelId` 始终由当前选择的模型提供。
4. 不同协议只读取自己关心的字段。

### 5.2 自定义模型内部 ID

继续为自定义模型生成稳定内部 ID，而不是直接持久化远端模型名：

```text
custom-provider:<providerId>:<modelId>
```

这样可以保证：

1. 用户修改远端模型名后，历史节点仍能解析到同一条本地模型配置。
2. 自定义模型的引用稳定，不受远端命名变化影响。
3. 删除或禁用模型时，节点可以按本地 `providerId/modelId` 做回退处理。

### 5.3 节点运行时上下文

`resolveGenerationContext` 负责根据当前选中的运行时模型生成 `providerRuntime`。

规则如下：

1. 内置供应商继续从 `apiKeys[providerId]` 取密钥。
2. 自定义 `openapi` 从 `connection.openapi` 解析 `baseUrl`、`apiKey`、`remoteModelId`。
3. 自定义 `xais-task` 从 `connection.xaisTask` 解析 `submitBaseUrl`、`waitBaseUrl`、`assetBaseUrl`、`apiKey`、`remoteModelId`。
4. 只要协议必填字段不完整，就视为未配置完成。

## 6. 协议执行设计

### 6.1 openapi 协议

`openapi` 保持同步协议语义，继续兼容以下请求格式：

```http
POST {baseUrl}/chat/completions
Authorization: Bearer {apiKey}
Content-Type: application/json
```

文生图请求：

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

图生图请求：

```json
{
  "model": "Nano_Banana_Pro_2K_0",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "将这张图上的人换成苹果创始人史蒂夫.乔布斯，图片长宽比9:16"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "https://..."
          }
        }
      ]
    }
  ]
}
```

返回解析规则：

1. 读取 `choices[0].message.content`。
2. 从 `![image](...)` 中提取第一个图片 URL。
3. 提取失败则返回协议解析错误。

### 6.2 xais-task 协议

`xais-task` 采用异步任务语义。

#### 6.2.1 提交任务

请求：

```http
POST {submitBaseUrl}/xais/workerTaskStart
Authorization: Bearer {apiKey}
Content-Type: application/json
x-request-id: <11位随机ID>
```

请求体：

```json
{
  "prompt": "改为油画风格",
  "model": "Nano_Banana_Pro_2K_0",
  "ref": ["https://example.com/ref.png"],
  "ratio": "16:9",
  "custom_field": {
    "outputFormat": "image/png"
  }
}
```

映射规则：

1. `prompt` 取当前生成提示词。
2. `model` 取自定义模型的 `remoteModelId`。
3. `ref` 使用当前参考图列表。
4. `ratio` 使用节点当前选择的长宽比。
5. `custom_field.outputFormat` 来自协议默认配置或节点额外参数。
6. 提交成功后立即返回任务 ID。

#### 6.2.2 等待任务

轮询请求：

```http
GET {waitBaseUrl}/xais/workerTaskWait?id=<taskId>&json=true
Authorization: Bearer {apiKey}
```

返回解析规则：

1. `{"error": null, "result": ["xxx.png"]}` 视为成功。
2. `result[0]` 视为图片 key。
3. `error` 非空视为失败。
4. 返回成功结构但 `result` 为空时视为任务仍在运行。

#### 6.2.3 图片地址解析

本次不直接持久化 `attUrls` 返回的签名地址。

原因：

1. 签名 URL 会过期。
2. 项目重新打开后，节点图片可能失效。

因此本次采用稳定资源地址策略：

```text
{assetBaseUrl}/xais/img?att=<imageKey>
```

其中默认资源地址可配置为：

```text
https://svt1.dchai.cn
```

`attUrls` 接口保留为后续增强能力，用于未来扩展预览图、缩略图或原图下载。

## 7. 任务框架集成

### 7.1 后端任务路由

后端保持现有 `submit_generate_image_job / get_generate_image_job` 不变，只调整协议分流：

1. `protocol = openapi`
   - 仍视为不可恢复任务。
   - 在后台异步线程中执行一次同步请求。
2. `protocol = xais-task`
   - 视为可恢复任务。
   - `submit_generate_image_job` 只负责提交任务并写入 `external_task_id`。
   - `get_generate_image_job` 中通过 `poll_task()` 继续查询任务结果。

### 7.2 任务表元数据

对于 `xais-task`，以下信息写入 `external_task_meta_json`：

1. `xRequestId`
2. `submitBaseUrl`
3. `waitBaseUrl`
4. `assetBaseUrl`
5. 可选 `lastKnownProgress`
6. 可选 `consecutivePollErrorCount`

这样可以支持：

1. 应用重启后继续等待同一任务。
2. 后续排查时区分提交异常、轮询异常与资源地址异常。

## 8. 前端交互与页面设计

### 8.1 供应商管理页

设置页左侧保留一级菜单 `供应商`。

右侧页面结构如下：

1. 顶部标题区
   - 页面标题
   - 页面描述
   - `添加供应商` 按钮
2. 下方列表区
   - 每一行显示供应商名称
   - 显示启用模型摘要
   - 显示 `编辑` 与 `删除` 按钮
3. 删除动作必须二次确认
4. 新增、编辑、删除成功后立即刷新列表

### 8.2 编辑弹窗布局

供应商编辑弹窗改为固定壳体：

1. 固定宽高基准为 `700px x 500px`。
2. 受 `max-width` 与 `max-height` 约束，适配较小窗口。
3. 结构分为三层：
   - 顶部标题栏
   - 中部滚动内容区
   - 底部固定操作栏
4. 模型列表本身再单独做内部滚动容器。

这样可以保证：

1. 模型数量增多时只出现内部滚动条。
2. 弹窗不会继续被向两侧或向下撑开。
3. 底部 `保存/取消` 始终固定可见。

### 8.3 编辑弹窗字段分组

弹窗按三组字段组织：

1. 公共字段
   - 供应商名称
   - 接入协议
2. 协议字段
   - `openapi`：
     - `baseUrl`
     - `apiKey`
   - `xais-task`：
     - `submitBaseUrl`
     - `waitBaseUrl`
     - `assetBaseUrl`
     - `apiKey`
     - 默认输出格式
3. 模型字段
   - 模型显示名
   - 远端模型 ID
   - 启用状态
   - 删除按钮

### 8.4 节点模型选择

生图节点保持“供应商 -> 模型”的二级级联选择逻辑：

1. 一级选择供应商。
2. 二级只显示该供应商下可用模型。
3. 自定义供应商与内置供应商并列出现在供应商选择中。
4. 选择自定义供应商后，后端自动切换到对应协议执行器。

## 9. 错误处理与恢复策略

### 9.1 openapi

`openapi` 视为同步协议：

1. `524`、超时、网络错误直接判当前任务失败。
2. 不做自动重试。
3. 错误提示必须明确说明：
   - 当前协议没有任务 ID。
   - 重新发起大概率会生成一张新图。

### 9.2 xais-task

`xais-task` 视为异步可恢复协议：

1. 只要任务提交成功拿到任务 ID，后续短暂网络异常不应立刻判失败。
2. 单次 `524`、单次轮询超时、单次网络抖动优先视为“任务仍在运行中”。
3. 以下情况才判失败：
   - `workerTaskStart` 明确报错
   - `workerTaskWait?json=true` 返回明确 `error`
   - 连续多次轮询异常超过阈值
   - 任务被判断为不可恢复

### 9.3 重启恢复

1. `openapi` 未完成任务在应用重启后直接标记失败。
2. `xais-task` 未完成任务在应用重启后继续按 `external_task_id` 轮询，不重新生成。

## 10. 校验规则

### 10.1 供应商配置校验

通用校验：

1. 供应商名称非空。
2. 至少存在一个启用模型。
3. 每个模型的显示名与远端模型 ID 非空。

协议校验：

1. `openapi`
   - `baseUrl` 非空
   - `apiKey` 非空
2. `xais-task`
   - `submitBaseUrl` 非空
   - `waitBaseUrl` 非空
   - `assetBaseUrl` 非空
   - `apiKey` 非空

### 10.2 节点回退规则

当节点保存的自定义模型失效时，按以下顺序回退：

1. 回退到同一供应商下第一个启用模型。
2. 若该供应商不存在可用模型，则回退到默认内置图片模型。

## 11. 测试与验收

### 11.1 前端测试

至少覆盖以下内容：

1. `customProviderConfig` 旧数据迁移测试。
2. `runtimeRegistry` 对 `openapi / xais-task` 的运行时模型生成测试。
3. `runtimeGenerationContext` 在不同协议下的运行时配置测试。
4. `CustomProviderEditorDialog` 的固定尺寸与内部滚动测试。
5. 协议切换后字段区变化测试。

### 11.2 Rust 测试

至少覆盖以下内容：

1. `openapi_compat` 的请求构建与返回解析测试。
2. `xais-task` 提交请求体映射测试。
3. `xais-task` 轮询返回解析测试。
4. `xais-task` 图片 key 到稳定资源 URL 的转换测试。
5. `ai_generation_jobs` 对可恢复任务的状态流测试。

### 11.3 手工验收

至少验证以下场景：

1. 供应商管理页可新增、编辑、删除自定义供应商。
2. 模型很多时，编辑弹窗不再被撑开，只在内部滚动。
3. `openapi` 自定义供应商仍能成功文生图与图生图。
4. `xais-task` 长耗时任务不会因单次 `524` 直接报废，而是继续等待同一任务。
5. 应用重启后，未完成的 `xais-task` 任务可继续恢复查询。

## 12. 实施顺序建议

建议按以下顺序实施：

1. 调整 `customProviderConfig` 与 `settingsStore`，完成新结构与旧数据迁移。
2. 调整运行时模型注册与 `resolveGenerationContext`。
3. 修复供应商管理页与编辑弹窗布局，接入协议分组字段。
4. 扩展前端 `RuntimeProviderConfig` 与 Tauri 请求 DTO。
5. 在 Rust 侧抽出协议执行器，补齐 `xais-task` 可恢复任务实现。
6. 补充测试并完成手工验证。

该顺序可以保证每一步都沿着现有数据流推进，避免跨层硬编码。
