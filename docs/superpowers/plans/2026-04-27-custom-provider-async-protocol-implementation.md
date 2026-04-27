# 自定义供应商异步接入协议改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为自定义供应商引入可扩展的“接入协议”结构，落地 `xais-task` 异步生成链路，并修复供应商编辑弹窗模型列表撑开问题。

**Architecture:** 前端把自定义供应商从平铺的 `openapi` 配置升级为“供应商公共信息 + 协议连接配置 + 模型列表”，运行时统一输出 `custom-provider` 类型的 `providerRuntime`。后端保留内置 provider 注册表不变，对自定义供应商改为按 `providerRuntime.protocol` 分发到 `openapi` 与 `xais-task` 协议执行器，其中 `xais-task` 复用现有 `ai_generation_jobs` 可恢复任务框架。

**Tech Stack:** React 18、TypeScript、Zustand、Vitest、Testing Library、Tauri 2、Rust、reqwest、serde_json、rusqlite

---

## 文件结构与职责

### 配置与持久化

- Modify: `src/stores/customProviderConfig.ts`
  - 将自定义供应商结构升级为“接入协议 + connection 配置”，兼容旧版 `baseUrl/apiKey`。
- Modify: `src/stores/customProviderConfig.test.ts`
  - 固定旧数据迁移、协议标准化、字段校验与内部模型 ID 规则。
- Modify: `src/stores/settingsStore.ts`
  - 持久化新结构并在 `persist.migrate` 中完成旧数据迁移。

### 运行时模型与生成上下文

- Modify: `src/features/canvas/models/types.ts`
  - 将 `RuntimeProviderConfig` 从 `custom-openapi` 泛化为 `custom-provider`。
- Modify: `src/features/canvas/models/runtimeRegistry.ts`
  - 生成支持多协议的运行时供应商与运行时模型定义。
- Modify: `src/features/canvas/models/runtimeRegistry.test.ts`
  - 校验 `openapi/xais-task` 的运行时 provider/model 输出。
- Modify: `src/features/canvas/application/runtimeGenerationContext.ts`
  - 根据协议提取完整的 `providerRuntime`。
- Modify: `src/features/canvas/application/runtimeGenerationContext.test.ts`
  - 校验不同协议下的配置完整性与可恢复信息。

### 供应商页面与编辑弹窗

- Modify: `src/components/settings/CustomProviderEditorDialog.tsx`
  - 改成固定尺寸、内部滚动、协议分组字段的弹窗。
- Modify: `src/components/settings/CustomProviderEditorDialog.test.tsx`
  - 校验协议字段切换、固定滚动容器与保存行为。
- Modify: `src/components/settings/CustomProvidersPage.tsx`
  - 保持列表页展示供应商名与模型摘要，配合新协议字段展示。
- Modify: `src/components/SettingsDialog.tsx`
  - 继续以弹窗即时保存方式写回 `customProviders`。
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`
  - 增加“接入协议”“Xais 任务协议”“提交地址/等待地址/资源地址”等文案。

### 前端传输与节点接线

- Modify: `src/commands/ai.ts`
  - 为 `provider_runtime` 扩展 `submitBaseUrl/waitBaseUrl/assetBaseUrl/outputFormat`。
- Modify: `src/features/canvas/application/buildNodeGeneratePayload.ts`
  - 保持节点生成 payload 对协议运行时配置的透传。
- Modify: `src/features/canvas/application/buildNodeGeneratePayload.test.ts`
  - 校验 `xais-task` 配置不会在前端组装阶段丢失。
- Modify: `src/features/canvas/ui/ModelParamsControls.test.tsx`
  - 更新为新 `custom-provider` 运行时类型与模型 ID。
- Modify: `src/features/canvas/nodes/ImageEditNode.tsx`
- Modify: `src/features/canvas/nodes/StoryboardGenNode.tsx`
  - 保持节点提交生成时使用新的 `providerRuntime` 结构。

### Tauri 协议执行器与任务路由

- Modify: `src-tauri/src/ai/mod.rs`
  - 扩展 `RuntimeProviderConfig`。
- Modify: `src-tauri/src/ai/providers/openapi_compat/mod.rs`
  - 适配新的运行时类型名与更明确的同步协议错误语义。
- Add: `src-tauri/src/ai/providers/xais_task/mod.rs`
  - 负责 `workerTaskStart`、`workerTaskWait?json=true`、图片 key 资源地址拼接。
- Modify: `src-tauri/src/ai/providers/mod.rs`
  - 暴露 `xais_task` 模块。
- Modify: `src-tauri/src/commands/ai.rs`
  - 基于 `provider_runtime.protocol` 路由到 `openapi` 或 `xais-task`。

---

### Task 1: 重构自定义供应商配置结构与旧数据迁移

**Files:**
- Modify: `src/stores/customProviderConfig.ts`
- Modify: `src/stores/customProviderConfig.test.ts`
- Modify: `src/stores/settingsStore.ts`

- [ ] **Step 1: 先补失败测试，固定新协议结构与旧版迁移行为**

```ts
// src/stores/customProviderConfig.test.ts
import { describe, expect, it } from 'vitest';
import {
  buildCustomProviderModelId,
  normalizeCustomProviders,
  validateCustomProviders,
} from './customProviderConfig';

describe('customProviderConfig', () => {
  it('migrates legacy openapi providers into connection.openapi', () => {
    const providers = normalizeCustomProviders([
      {
        id: ' gateway-a ',
        name: ' 公司网关 ',
        protocol: 'openapi',
        baseUrl: ' https://sg2c.dchai.cn/v1/ ',
        apiKey: ' token-1 ',
        models: [
          {
            id: 'model-main',
            displayName: 'Nano Banana Pro 2K',
            remoteModelId: 'Nano_Banana_Pro_2K_0',
            enabled: true,
          },
        ],
      } as unknown as never,
    ]);

    expect(providers[0]).toMatchObject({
      id: 'gateway-a',
      protocol: 'openapi',
      connection: {
        openapi: {
          baseUrl: 'https://sg2c.dchai.cn/v1',
          apiKey: 'token-1',
        },
      },
    });
  });

  it('normalizes xais-task connection fields', () => {
    const providers = normalizeCustomProviders([
      {
        id: 'gateway-xais',
        name: 'Xais Gateway',
        protocol: 'xais-task',
        connection: {
          xaisTask: {
            submitBaseUrl: ' https://sg2c.dchai.cn/ ',
            waitBaseUrl: ' https://sg2.dchai.cn/ ',
            assetBaseUrl: ' https://svt1.dchai.cn/ ',
            apiKey: ' token-2 ',
            defaultOutputFormat: 'image/png',
          },
        },
        models: [
          {
            id: 'banana',
            displayName: 'Nano Banana Pro',
            remoteModelId: 'Nano_Banana_Pro_2K_0',
            enabled: true,
          },
        ],
      },
    ]);

    expect(providers[0].connection.xaisTask).toEqual({
      submitBaseUrl: 'https://sg2c.dchai.cn',
      waitBaseUrl: 'https://sg2.dchai.cn',
      assetBaseUrl: 'https://svt1.dchai.cn',
      apiKey: 'token-2',
      defaultOutputFormat: 'image/png',
    });
  });

  it('builds stable internal ids for custom-provider models', () => {
    expect(buildCustomProviderModelId('gateway-a', 'model-main')).toBe(
      'custom-provider:gateway-a:model-main'
    );
  });

  it('reports missing xais-task connection fields', () => {
    expect(
      validateCustomProviders([
        {
          id: 'gateway-xais',
          name: 'Xais Gateway',
          protocol: 'xais-task',
          connection: {
            xaisTask: {
              submitBaseUrl: '',
              waitBaseUrl: '',
              assetBaseUrl: '',
              apiKey: '',
            },
          },
          models: [],
        },
      ])
    ).toEqual([
      'provider[0].connection.xaisTask.submitBaseUrl',
      'provider[0].connection.xaisTask.waitBaseUrl',
      'provider[0].connection.xaisTask.assetBaseUrl',
      'provider[0].connection.xaisTask.apiKey',
      'provider[0].models',
    ]);
  });
});
```

- [ ] **Step 2: 运行测试，确认当前实现尚不支持新结构**

Run:

```bash
npx vitest run src/stores/customProviderConfig.test.ts
```

Expected:

```text
FAIL  buildCustomProviderModelId 返回 custom-openapi 前缀
FAIL  provider.connection 未定义或 xais-task 字段缺失
```

- [ ] **Step 3: 最小实现新结构、标准化与迁移逻辑**

```ts
// src/stores/customProviderConfig.ts
export type CustomProviderProtocol = 'openapi' | 'xais-task';

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

export function buildCustomProviderModelId(providerId: string, modelId: string): string {
  return `custom-provider:${normalizeConfigId(providerId)}:${normalizeConfigId(modelId)}`;
}

function normalizeConnection(
  provider: Record<string, unknown>,
  protocol: CustomProviderProtocol
): CustomProviderConfig['connection'] {
  if (protocol === 'xais-task') {
    const xaisTask = (provider.connection as { xaisTask?: XaisTaskConnectionConfig } | undefined)?.xaisTask;
    return {
      xaisTask: {
        submitBaseUrl: normalizeBaseUrl(xaisTask?.submitBaseUrl),
        waitBaseUrl: normalizeBaseUrl(xaisTask?.waitBaseUrl),
        assetBaseUrl: normalizeBaseUrl(xaisTask?.assetBaseUrl),
        apiKey: trim(xaisTask?.apiKey),
        defaultOutputFormat:
          xaisTask?.defaultOutputFormat === 'image/jpeg' ? 'image/jpeg' : 'image/png',
      },
    };
  }

  const openapi = (provider.connection as { openapi?: OpenApiConnectionConfig } | undefined)?.openapi;
  return {
    openapi: {
      baseUrl: normalizeBaseUrl(openapi?.baseUrl ?? (provider.baseUrl as string | undefined)),
      apiKey: trim(openapi?.apiKey ?? (provider.apiKey as string | undefined)),
    },
  };
}

export function createCustomProviderDraft(): CustomProviderConfig {
  return {
    id: createDraftId('provider'),
    name: '',
    protocol: 'openapi',
    connection: {
      openapi: {
        baseUrl: '',
        apiKey: '',
      },
    },
    models: [createCustomProviderModelDraft()],
  };
}
```

```ts
// src/stores/settingsStore.ts 关键片段
setCustomProviders: (customProviders) =>
  set({ customProviders: normalizeCustomProviders(customProviders) }),

const migratedCustomProviders = normalizeCustomProviders(state.customProviders);

return {
  ...(persistedState as object),
  customProviders: migratedCustomProviders,
};
```

- [ ] **Step 4: 重新运行定向测试与类型检查**

Run:

```bash
npx vitest run src/stores/customProviderConfig.test.ts
npx tsc --noEmit
```

Expected:

```text
✓ src/stores/customProviderConfig.test.ts
无 TypeScript 报错
```

- [ ] **Step 5: 提交配置结构改动**

```bash
git add src/stores/customProviderConfig.ts src/stores/customProviderConfig.test.ts src/stores/settingsStore.ts
git commit -m "feat: add protocol-based custom provider config"
```

### Task 2: 扩展运行时模型与生成上下文

**Files:**
- Modify: `src/features/canvas/models/types.ts`
- Modify: `src/features/canvas/models/runtimeRegistry.ts`
- Modify: `src/features/canvas/models/runtimeRegistry.test.ts`
- Modify: `src/features/canvas/application/runtimeGenerationContext.ts`
- Modify: `src/features/canvas/application/runtimeGenerationContext.test.ts`

- [ ] **Step 1: 先写失败测试，固定 openapi 与 xais-task 的运行时输出**

```ts
// src/features/canvas/models/runtimeRegistry.test.ts
it('creates runtime metadata for xais-task providers', () => {
  const models = listRuntimeImageModels([
    {
      id: 'gateway-xais',
      name: 'Xais Gateway',
      protocol: 'xais-task',
      connection: {
        xaisTask: {
          submitBaseUrl: 'https://sg2c.dchai.cn',
          waitBaseUrl: 'https://sg2.dchai.cn',
          assetBaseUrl: 'https://svt1.dchai.cn',
          apiKey: 'token-2',
          defaultOutputFormat: 'image/png',
        },
      },
      models: [
        {
          id: 'banana',
          displayName: 'Nano Banana Pro',
          remoteModelId: 'Nano_Banana_Pro_2K_0',
          enabled: true,
        },
      ],
    },
  ]);

  const model = models.find((item) => item.id === 'custom-provider:gateway-xais:banana');
  expect(model?.runtimeProvider.kind).toBe('custom-provider');
  expect(model?.runtimeProvider.protocol).toBe('xais-task');
  expect(model?.runtimeProvider.waitBaseUrl).toBe('https://sg2.dchai.cn');
});
```

```ts
// src/features/canvas/application/runtimeGenerationContext.test.ts
it('returns resumable custom provider runtime for xais-task models', () => {
  const model = getRuntimeImageModel('custom-provider:gateway-xais:banana', [
    {
      id: 'gateway-xais',
      name: 'Xais Gateway',
      protocol: 'xais-task',
      connection: {
        xaisTask: {
          submitBaseUrl: 'https://sg2c.dchai.cn',
          waitBaseUrl: 'https://sg2.dchai.cn',
          assetBaseUrl: 'https://svt1.dchai.cn',
          apiKey: 'token-2',
          defaultOutputFormat: 'image/png',
        },
      },
      models: [
        {
          id: 'banana',
          displayName: 'Nano Banana Pro',
          remoteModelId: 'Nano_Banana_Pro_2K_0',
          enabled: true,
        },
      ],
    },
  ]);

  const context = resolveGenerationContext(model, {});
  expect(context.isConfigured).toBe(true);
  expect(context.shouldSetApiKey).toBe(false);
  expect(context.resumeProviderId).toBeNull();
  expect(context.providerRuntime).toMatchObject({
    kind: 'custom-provider',
    protocol: 'xais-task',
    assetBaseUrl: 'https://svt1.dchai.cn',
  });
});
```

- [ ] **Step 2: 运行测试，确认当前运行时仍停留在 custom-openapi**

Run:

```bash
npx vitest run src/features/canvas/models/runtimeRegistry.test.ts src/features/canvas/application/runtimeGenerationContext.test.ts
```

Expected:

```text
FAIL  runtimeProvider.kind 为 custom-openapi
FAIL  不存在 waitBaseUrl/assetBaseUrl 字段
```

- [ ] **Step 3: 最小实现新的运行时 provider 结构**

```ts
// src/features/canvas/models/types.ts
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

export interface RuntimeModelProviderDefinition extends ModelProviderDefinition {
  runtimeKind: 'builtin' | 'custom-provider';
  configured: boolean;
  providerProfileId?: string;
  protocol?: 'openapi' | 'xais-task';
}
```

```ts
// src/features/canvas/models/runtimeRegistry.ts 关键片段
const customs = customProviders.map((provider) => ({
  id: buildCustomRuntimeProviderId(provider.id),
  name: provider.name,
  label: provider.name,
  runtimeKind: 'custom-provider' as const,
  configured:
    provider.protocol === 'xais-task'
      ? Boolean(provider.connection.xaisTask?.apiKey?.trim())
      : Boolean(provider.connection.openapi?.apiKey?.trim()),
  providerProfileId: provider.id,
  protocol: provider.protocol,
}));

runtimeProvider: provider.protocol === 'xais-task'
  ? {
      kind: 'custom-provider',
      providerProfileId: provider.id,
      providerDisplayName: provider.name,
      protocol: 'xais-task',
      submitBaseUrl: provider.connection.xaisTask?.submitBaseUrl,
      waitBaseUrl: provider.connection.xaisTask?.waitBaseUrl,
      assetBaseUrl: provider.connection.xaisTask?.assetBaseUrl,
      apiKey: provider.connection.xaisTask?.apiKey,
      outputFormat: provider.connection.xaisTask?.defaultOutputFormat,
      remoteModelId: model.remoteModelId,
    }
  : {
      kind: 'custom-provider',
      providerProfileId: provider.id,
      providerDisplayName: provider.name,
      protocol: 'openapi',
      baseUrl: provider.connection.openapi?.baseUrl,
      apiKey: provider.connection.openapi?.apiKey,
      remoteModelId: model.remoteModelId,
    }
```

```ts
// src/features/canvas/application/runtimeGenerationContext.ts 关键片段
if (model.runtimeProvider.kind === 'custom-provider') {
  if (model.runtimeProvider.protocol === 'xais-task') {
    const submitBaseUrl = trim(model.runtimeProvider.submitBaseUrl);
    const waitBaseUrl = trim(model.runtimeProvider.waitBaseUrl);
    const assetBaseUrl = trim(model.runtimeProvider.assetBaseUrl);
    const apiKey = trim(model.runtimeProvider.apiKey);
    const remoteModelId = trim(model.runtimeProvider.remoteModelId);
    const isConfigured =
      apiKey.length > 0 &&
      submitBaseUrl.length > 0 &&
      waitBaseUrl.length > 0 &&
      assetBaseUrl.length > 0 &&
      remoteModelId.length > 0;

    return {
      apiKey,
      isConfigured,
      shouldSetApiKey: false,
      resumeProviderId: null,
      providerRuntime: isConfigured
        ? {
            ...model.runtimeProvider,
            apiKey,
            submitBaseUrl,
            waitBaseUrl,
            assetBaseUrl,
            remoteModelId,
          }
        : undefined,
    };
  }
}
```

- [ ] **Step 4: 重新运行运行时测试**

Run:

```bash
npx vitest run src/features/canvas/models/runtimeRegistry.test.ts src/features/canvas/application/runtimeGenerationContext.test.ts
```

Expected:

```text
✓ runtimeRegistry tests
✓ runtimeGenerationContext tests
```

- [ ] **Step 5: 提交运行时模型改动**

```bash
git add src/features/canvas/models/types.ts src/features/canvas/models/runtimeRegistry.ts src/features/canvas/models/runtimeRegistry.test.ts src/features/canvas/application/runtimeGenerationContext.ts src/features/canvas/application/runtimeGenerationContext.test.ts
git commit -m "feat: extend runtime providers for async protocols"
```

### Task 3: 修复供应商编辑弹窗布局并接入协议分组字段

**Files:**
- Modify: `src/components/settings/CustomProviderEditorDialog.tsx`
- Modify: `src/components/settings/CustomProviderEditorDialog.test.tsx`
- Modify: `src/components/settings/CustomProvidersPage.tsx`
- Modify: `src/components/SettingsDialog.tsx`
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: 先补失败测试，固定协议切换与内部滚动容器**

```tsx
// src/components/settings/CustomProviderEditorDialog.test.tsx
it('switches protocol fields and keeps a dedicated scroll container', async () => {
  const user = userEvent.setup();

  render(
    <CustomProviderEditorDialog
      isOpen
      mode="create"
      initialProvider={null}
      onClose={vi.fn()}
      onSave={vi.fn()}
    />
  );

  expect(screen.getByLabelText('settings.customProviderBaseUrl')).toBeInTheDocument();
  expect(screen.queryByLabelText('settings.customProviderSubmitBaseUrl')).not.toBeInTheDocument();

  await user.selectOptions(
    screen.getByLabelText('settings.customProviderProtocol'),
    'xais-task'
  );

  expect(screen.getByLabelText('settings.customProviderSubmitBaseUrl')).toBeInTheDocument();
  expect(screen.getByLabelText('settings.customProviderWaitBaseUrl')).toBeInTheDocument();
  expect(screen.getByLabelText('settings.customProviderAssetBaseUrl')).toBeInTheDocument();
  expect(screen.getByTestId('custom-provider-models-scroll')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行组件测试，确认当前表单只支持 openapi 平铺字段**

Run:

```bash
npx vitest run src/components/settings/CustomProviderEditorDialog.test.tsx
```

Expected:

```text
FAIL  找不到 settings.customProviderSubmitBaseUrl
FAIL  不存在 custom-provider-models-scroll
```

- [ ] **Step 3: 最小实现固定壳体、协议字段区与模型内滚**

```tsx
// src/components/settings/CustomProviderEditorDialog.tsx 关键片段
<UiModal
  isOpen={isOpen}
  title={mode === 'create' ? t('settings.addSupplier') : t('settings.editSupplier')}
  onClose={onClose}
  widthClassName="h-[500px] w-[700px] max-w-[96vw]"
  bodyClassName="min-h-0"
  footer={(
    <>
      <UiButton variant="muted" size="sm" onClick={onClose}>
        {t('common.cancel')}
      </UiButton>
      <UiButton variant="primary" size="sm" onClick={handleSave}>
        {t('common.save')}
      </UiButton>
    </>
  )}
>
  <div className="flex h-full min-h-0 flex-col gap-4">
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1">
        <span className="text-xs font-medium text-text-dark">{t('settings.customProviderProtocol')}</span>
        <UiSelect
          aria-label={t('settings.customProviderProtocol')}
          value={draft.protocol}
          onChange={(event) => handleProtocolChange(event.target.value as CustomProviderConfig['protocol'])}
          className="h-10 text-sm"
        >
          <option value="openapi">{t('settings.customProviderProtocolOpenapi')}</option>
          <option value="xais-task">{t('settings.customProviderProtocolXaisTask')}</option>
        </UiSelect>
      </label>
    </div>

    {draft.protocol === 'openapi' ? (
      <label className="space-y-1">
        <span className="text-xs font-medium text-text-dark">{t('settings.customProviderBaseUrl')}</span>
        <UiInput
          aria-label={t('settings.customProviderBaseUrl')}
          value={draft.connection.openapi?.baseUrl ?? ''}
          onChange={(event) => patchOpenApiConnection({ baseUrl: event.target.value })}
        />
      </label>
    ) : (
      <div className="grid gap-3 md:grid-cols-2">
        <UiInput
          aria-label={t('settings.customProviderSubmitBaseUrl')}
          value={draft.connection.xaisTask?.submitBaseUrl ?? ''}
          onChange={(event) => patchXaisConnection({ submitBaseUrl: event.target.value })}
        />
        <UiInput
          aria-label={t('settings.customProviderWaitBaseUrl')}
          value={draft.connection.xaisTask?.waitBaseUrl ?? ''}
          onChange={(event) => patchXaisConnection({ waitBaseUrl: event.target.value })}
        />
        <UiInput
          aria-label={t('settings.customProviderAssetBaseUrl')}
          value={draft.connection.xaisTask?.assetBaseUrl ?? ''}
          onChange={(event) => patchXaisConnection({ assetBaseUrl: event.target.value })}
        />
      </div>
    )}

    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border-dark bg-bg-dark/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-text-dark">{t('settings.customProviderModels')}</div>
        <UiButton type="button" size="sm" variant="ghost" onClick={handleAddModel}>
          <Plus className="h-4 w-4" />
          {t('settings.addCustomProviderModel')}
        </UiButton>
      </div>
      <div data-testid="custom-provider-models-scroll" className="ui-scrollbar mt-3 min-h-0 flex-1 overflow-y-auto space-y-3 pr-1">
        {draft.models.map((model) => (
          <div key={model.id} className="min-w-0 space-y-3 rounded-lg border border-border-dark bg-surface-dark p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 truncate text-xs font-medium text-text-dark">
                {model.displayName || t('settings.customProviderModelUntitled')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
</UiModal>
```

- [ ] **Step 4: 运行供应商编辑与设置页相关测试**

Run:

```bash
npx vitest run src/components/settings/CustomProviderEditorDialog.test.tsx src/components/SettingsDialog.test.tsx src/components/settings/CustomProvidersPage.test.tsx
```

Expected:

```text
✓ CustomProviderEditorDialog tests
✓ SettingsDialog tests
✓ CustomProvidersPage tests
```

- [ ] **Step 5: 提交供应商 UI 改动**

```bash
git add src/components/settings/CustomProviderEditorDialog.tsx src/components/settings/CustomProviderEditorDialog.test.tsx src/components/settings/CustomProvidersPage.tsx src/components/SettingsDialog.tsx src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "feat: add protocol-aware supplier editor dialog"
```

### Task 4: 实现 xais-task 协议执行器与后端任务分流

**Files:**
- Modify: `src-tauri/src/ai/mod.rs`
- Modify: `src-tauri/src/ai/providers/openapi_compat/mod.rs`
- Add: `src-tauri/src/ai/providers/xais_task/mod.rs`
- Modify: `src-tauri/src/ai/providers/mod.rs`
- Modify: `src-tauri/src/commands/ai.rs`

- [ ] **Step 1: 先写 Rust 失败测试，固定 Xais 请求映射、轮询解析与资源地址转换**

```rust
// src-tauri/src/ai/providers/xais_task/mod.rs
#[cfg(test)]
mod tests {
    use super::{build_asset_url, build_submit_body, parse_wait_json};
    use serde_json::json;

    #[test]
    fn build_submit_body_maps_prompt_model_ref_and_ratio() {
        let body = build_submit_body(
            "改为油画风格",
            "Nano_Banana_Pro_2K_0",
            &vec!["https://example.com/ref.png".to_string()],
            "16:9",
            Some("image/png"),
        );

        assert_eq!(body["prompt"], "改为油画风格");
        assert_eq!(body["model"], "Nano_Banana_Pro_2K_0");
        assert_eq!(body["ratio"], "16:9");
        assert_eq!(body["custom_field"]["outputFormat"], "image/png");
    }

    #[test]
    fn parse_wait_json_returns_image_key_when_result_exists() {
        let payload = json!({
            "error": null,
            "result": ["d5/260422/200/CC7M3DHCA_6A.png"]
        });

        let parsed = parse_wait_json(&payload).unwrap();
        assert_eq!(parsed.result_key.as_deref(), Some("d5/260422/200/CC7M3DHCA_6A.png"));
        assert!(!parsed.is_running);
    }

    #[test]
    fn build_asset_url_uses_stable_att_endpoint() {
        assert_eq!(
            build_asset_url("https://svt1.dchai.cn", "d5/260422/200/CC7M3DHCA_6A.png"),
            "https://svt1.dchai.cn/xais/img?att=d5/260422/200/CC7M3DHCA_6A.png"
        );
    }
}
```

- [ ] **Step 2: 运行 Rust 测试，确认模块尚未存在**

Run:

```bash
cd src-tauri
cargo test xais_task
```

Expected:

```text
error: couldn't read src/ai/providers/xais_task/mod.rs
```

- [ ] **Step 3: 最小实现协议模块与命令层分流**

```rust
// src-tauri/src/ai/mod.rs 关键片段
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeProviderConfig {
    pub kind: String,
    pub provider_profile_id: Option<String>,
    pub provider_display_name: Option<String>,
    pub protocol: Option<String>,
    pub base_url: Option<String>,
    pub submit_base_url: Option<String>,
    pub wait_base_url: Option<String>,
    pub asset_base_url: Option<String>,
    pub api_key: Option<String>,
    pub remote_model_id: Option<String>,
    pub output_format: Option<String>,
}
```

```rust
// src-tauri/src/ai/providers/xais_task/mod.rs 关键片段
pub struct WaitPollResult {
    pub is_running: bool,
    pub result_key: Option<String>,
    pub error_message: Option<String>,
}

pub fn build_submit_body(
    prompt: &str,
    model: &str,
    refs: &[String],
    ratio: &str,
    output_format: Option<&str>,
) -> serde_json::Value {
    serde_json::json!({
        "prompt": prompt,
        "model": model,
        "ref": refs,
        "ratio": ratio,
        "custom_field": output_format.map(|value| serde_json::json!({ "outputFormat": value })).unwrap_or(serde_json::json!({}))
    })
}

pub fn build_asset_url(asset_base_url: &str, image_key: &str) -> String {
    format!("{}/xais/img?att={}", asset_base_url.trim_end_matches('/'), image_key)
}

pub async fn submit_task(
    request: &GenerateRequest,
    runtime: &RuntimeProviderConfig,
) -> Result<ProviderTaskHandle, AIError> {
    // 生成 11 位 x-request-id，POST workerTaskStart，提取任务 ID
}

pub async fn poll_task(
    handle: &ProviderTaskHandle,
    runtime: &RuntimeProviderConfig,
) -> Result<ProviderTaskPollResult, AIError> {
    // GET workerTaskWait?id=<taskId>&json=true，running 继续等待，成功后拼稳定资源 URL
}
```

```rust
// src-tauri/src/commands/ai.rs 关键片段
fn is_custom_provider_runtime(runtime: Option<&crate::ai::RuntimeProviderConfig>) -> bool {
    matches!(runtime.map(|runtime| runtime.kind.as_str()), Some("custom-provider"))
}

fn resolve_custom_protocol(runtime: &crate::ai::RuntimeProviderConfig) -> Option<&str> {
    runtime.protocol.as_deref()
}

if is_custom_provider_runtime(req.provider_runtime.as_ref()) {
    let runtime = req
        .provider_runtime
        .clone()
        .ok_or_else(|| "Missing custom provider runtime config".to_string())?;

    match resolve_custom_protocol(&runtime) {
        Some("openapi") => {
            // 维持现有不可恢复后台任务逻辑
        }
        Some("xais-task") => {
            let handle = crate::ai::providers::xais_task::submit_task(&req, &runtime)
                .await
                .map_err(|error| error.to_string())?;
            let meta_json = serde_json::json!({
                "xRequestId": handle.metadata.as_ref().and_then(|meta| meta.get("xRequestId")).cloned(),
                "submitBaseUrl": runtime.submit_base_url,
                "waitBaseUrl": runtime.wait_base_url,
                "assetBaseUrl": runtime.asset_base_url,
            })
            .to_string();

            insert_generation_job(
                &app,
                job_id.as_str(),
                "xais_task",
                "running",
                true,
                Some(handle.task_id.as_str()),
                Some(meta_json.as_str()),
                None,
                None,
            )?;
            return Ok(job_id);
        }
        _ => return Err("Unsupported custom provider protocol".to_string()),
    }
}
```

- [ ] **Step 4: 运行 Rust 测试与快速检查**

Run:

```bash
cd src-tauri
cargo test xais_task
cargo test openapi_compat
cargo check
```

Expected:

```text
test build_submit_body_maps_prompt_model_ref_and_ratio ... ok
test parse_wait_json_returns_image_key_when_result_exists ... ok
test build_asset_url_uses_stable_att_endpoint ... ok
Finished dev [unoptimized + debuginfo] target(s) in ...
```

- [ ] **Step 5: 提交后端协议执行器改动**

```bash
git add src-tauri/src/ai/mod.rs src-tauri/src/ai/providers/openapi_compat/mod.rs src-tauri/src/ai/providers/xais_task/mod.rs src-tauri/src/ai/providers/mod.rs src-tauri/src/commands/ai.rs
git commit -m "feat: add xais task protocol executor"
```

### Task 5: 接线上下游传输、节点提交与最终验证

**Files:**
- Modify: `src/commands/ai.ts`
- Modify: `src/features/canvas/application/buildNodeGeneratePayload.ts`
- Modify: `src/features/canvas/application/buildNodeGeneratePayload.test.ts`
- Modify: `src/features/canvas/ui/ModelParamsControls.test.tsx`
- Modify: `src/features/canvas/nodes/ImageEditNode.tsx`
- Modify: `src/features/canvas/nodes/StoryboardGenNode.tsx`

- [ ] **Step 1: 先补失败测试，固定前端 payload 对 xais-task 配置的透传**

```ts
// src/features/canvas/application/buildNodeGeneratePayload.test.ts
it('keeps xais-task runtime fields in generate payload', () => {
  const payload = buildNodeGeneratePayload({
    prompt: '改为油画风格',
    requestModel: 'custom-provider:gateway-xais:banana',
    size: '1K',
    aspectRatio: '16:9',
    referenceImages: ['https://example.com/ref.png'],
    extraParams: {},
    providerRuntime: {
      kind: 'custom-provider',
      providerProfileId: 'gateway-xais',
      providerDisplayName: 'Xais Gateway',
      protocol: 'xais-task',
      submitBaseUrl: 'https://sg2c.dchai.cn',
      waitBaseUrl: 'https://sg2.dchai.cn',
      assetBaseUrl: 'https://svt1.dchai.cn',
      apiKey: 'token-2',
      remoteModelId: 'Nano_Banana_Pro_2K_0',
      outputFormat: 'image/png',
    },
  });

  expect(payload.providerRuntime).toMatchObject({
    protocol: 'xais-task',
    submitBaseUrl: 'https://sg2c.dchai.cn',
    waitBaseUrl: 'https://sg2.dchai.cn',
    assetBaseUrl: 'https://svt1.dchai.cn',
  });
});
```

```ts
// src/features/canvas/ui/ModelParamsControls.test.tsx 关键断言改动
expect(onModelChange).toHaveBeenCalledWith('custom-provider:gateway-a:model-main');
```

- [ ] **Step 2: 运行前端定向测试，确认旧的 custom-openapi 契约已失效**

Run:

```bash
npx vitest run src/features/canvas/application/buildNodeGeneratePayload.test.ts src/features/canvas/ui/ModelParamsControls.test.tsx src/features/canvas/models/runtimeRegistry.test.ts src/features/canvas/application/runtimeGenerationContext.test.ts
```

Expected:

```text
FAIL  仍使用 custom-openapi 模型 ID 或旧 provider kind
```

- [ ] **Step 3: 最小实现前端 DTO 与节点接线更新**

```ts
// src/commands/ai.ts 关键片段
provider_runtime: request.provider_runtime
  ? {
      ...request.provider_runtime,
      submitBaseUrl: request.provider_runtime.submitBaseUrl,
      waitBaseUrl: request.provider_runtime.waitBaseUrl,
      assetBaseUrl: request.provider_runtime.assetBaseUrl,
      outputFormat: request.provider_runtime.outputFormat,
    }
  : undefined,
```

```ts
// src/features/canvas/application/buildNodeGeneratePayload.ts
return {
  prompt: input.prompt,
  model: input.requestModel,
  size: input.size,
  aspectRatio: input.aspectRatio,
  referenceImages: input.referenceImages,
  extraParams: input.extraParams,
  providerRuntime: input.providerRuntime,
};
```

```tsx
// src/features/canvas/nodes/ImageEditNode.tsx / StoryboardGenNode.tsx 关键片段
const jobId = await canvasAiGateway.submitGenerateImageJob(
  buildNodeGeneratePayload({
    prompt,
    requestModel: requestResolution.requestModel,
    size: selectedResolution.value,
    aspectRatio: resolvedRequestAspectRatio,
    referenceImages: incomingImages,
    extraParams: effectiveExtraParams,
    providerRuntime: generationContext.providerRuntime,
  })
);
```

- [ ] **Step 4: 完整运行本次变更涉及的自动化验证**

Run:

```bash
npx vitest run src/stores/customProviderConfig.test.ts src/components/settings/CustomProviderEditorDialog.test.tsx src/features/canvas/models/runtimeRegistry.test.ts src/features/canvas/application/runtimeGenerationContext.test.ts src/features/canvas/application/buildNodeGeneratePayload.test.ts src/features/canvas/ui/ModelParamsControls.test.tsx
npx tsc --noEmit
cd src-tauri && cargo test xais_task && cargo test openapi_compat && cargo check
cd .. && npm run build
```

Expected:

```text
所有定向 Vitest 测试通过
无 TypeScript 报错
Rust 测试与 cargo check 通过
Vite/Tauri 前端构建成功
```

- [ ] **Step 5: 做一轮手工联调并提交收尾改动**

Run:

```bash
npm run tauri dev
```

Manual verification:

```text
1. 在“供应商”页新增一个 openapi 供应商，确认仍可成功文生图与图生图。
2. 在“供应商”页新增一个 xais-task 供应商，填写 submit/wait/asset 三段地址与模型 ID。
3. 选择 xais-task 模型发起生图，确认创建 export 节点后立即返回 jobId，不阻塞在同步请求。
4. 在等待过程中模拟一次长等待，确认不会因单次 524 立刻重新生成，而是继续查询同一任务。
5. 关闭并重新打开应用后，确认未完成的 xais-task 任务仍能继续恢复轮询。
6. 供应商编辑弹窗连续添加多个模型，确认只在模型区内部滚动，不再撑开整个窗口。
```

```bash
git add src/commands/ai.ts src/features/canvas/application/buildNodeGeneratePayload.ts src/features/canvas/application/buildNodeGeneratePayload.test.ts src/features/canvas/ui/ModelParamsControls.test.tsx src/features/canvas/nodes/ImageEditNode.tsx src/features/canvas/nodes/StoryboardGenNode.tsx
git commit -m "feat: wire async custom provider protocols end to end"
```
