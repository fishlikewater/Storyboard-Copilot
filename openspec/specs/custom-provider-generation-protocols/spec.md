# custom-provider-generation-protocols Specification

## Purpose
定义自定义供应商在不同接入协议下的图片生成路由、任务恢复与结果解析行为，确保 `openapi` 与 `xais-task` 两类协议都能被稳定接入和验证。

## Requirements
### Requirement: 自定义供应商必须按接入协议路由图片生成请求
系统必须根据自定义供应商当前配置的接入协议，将图片生成请求路由到对应的协议执行器，而不是始终复用单一的同步 `openapi` 实现。

#### Scenario: 使用 openapi 自定义供应商发起图片生成
- **WHEN** 用户选择一个接入协议为 `openapi` 的自定义供应商模型并发起生成
- **THEN** 系统必须向 `{baseUrl}/chat/completions` 发送兼容的生成请求
- **AND** 系统必须从 `choices[0].message.content` 中解析 Markdown 图片地址作为结果

#### Scenario: 使用 xais-task 自定义供应商发起图片生成
- **WHEN** 用户选择一个接入协议为 `xais-task` 的自定义供应商模型并发起生成
- **THEN** 系统必须先调用 `workerTaskStart` 创建远端任务
- **AND** 系统必须保存远端任务 ID 以供后续继续等待同一任务结果

### Requirement: xais-task 必须作为可恢复任务接入生成任务框架
系统必须将 `xais-task` 生图任务视为可恢复任务。只要任务提交成功拿到远端任务 ID，应用就必须能够在后续轮询中继续查询该任务，而不是重新发起一次新的生成。

#### Scenario: xais-task 提交成功后返回本地 job
- **WHEN** 系统成功调用 `workerTaskStart` 并获得远端任务 ID
- **THEN** 系统必须把当前本地生成任务记录为 `running`
- **AND** 系统必须把远端任务 ID 存入可恢复任务记录

#### Scenario: 应用重启后继续查询同一个 xais-task 任务
- **WHEN** 用户在 `xais-task` 任务仍处于运行中时重启应用并重新进入画布
- **THEN** 系统必须继续使用已保存的远端任务 ID 查询任务状态
- **AND** 系统不得重新创建一个新的远端生成任务

### Requirement: xais-task 轮询结果必须使用稳定资源地址
系统必须把 `workerTaskWait?json=true` 返回的图片 key 转换为稳定的资源地址，而不是把一次性签名下载地址持久化为最终图片结果。

#### Scenario: xais-task 返回图片 key
- **WHEN** `workerTaskWait?json=true` 返回 `result[0]` 为图片 key
- **THEN** 系统必须将该图片 key 转换为 `{assetBaseUrl}/xais/img?att=<key>` 形式的稳定资源地址
- **AND** 该稳定资源地址必须作为节点图片结果持久化

### Requirement: 不可恢复的 openapi 超时不得隐式重试
系统必须将 `openapi` 自定义供应商视为不可恢复协议。当同步请求发生超时、`524` 或网络错误时，系统必须直接将本次生成标记为失败，而不是隐式重试或重新发起新的远端生成。

#### Scenario: openapi 自定义供应商请求超时
- **WHEN** 用户使用 `openapi` 自定义供应商发起生成且同步请求超时
- **THEN** 系统必须将当前生成任务标记为失败
- **AND** 系统必须告知该协议没有可恢复的任务 ID，因此重新发起可能得到一张新的图片

### Requirement: xais-task 的短暂轮询异常不得立即视为任务失败
系统必须将 `xais-task` 的单次轮询超时、单次 `524` 或单次网络异常优先视为“任务仍在运行中”，并继续等待同一远端任务，只有明确失败或连续异常超过阈值时才可判定失败。

#### Scenario: xais-task 在等待过程中出现单次 524
- **WHEN** 系统在轮询某个运行中的 `xais-task` 时遇到单次 `524`
- **THEN** 系统必须保留该本地任务为运行中状态
- **AND** 系统必须在后续继续查询同一个远端任务 ID
