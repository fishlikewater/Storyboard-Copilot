# 独立供应商管理页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将自定义供应商从设置页 `providers` 分类中拆分为独立“供应商”页面，支持列表、新增/编辑弹窗、删除二次确认，并保持 OpenAPI 兼容运行时与生图模型二级选择不回归。

**Architecture:** 继续以 `customProviders` 作为单一真相源，不改动 `runtimeRegistry`、`providerRuntime` 和 Rust OpenAPI 兼容协议。前端只重构设置页信息架构：把内置 API Key 配置收敛到“API 配置”页，把自定义供应商迁移到独立“供应商”页，并通过即时写入 `settingsStore` 的方式让新增、编辑、删除立即反映到运行时模型列表。

**Tech Stack:** React、TypeScript、Zustand、TailwindCSS、Vitest、Testing Library

---

## File Structure

- Modify: `src/features/settings/settingsEvents.ts`
  - 扩展 `SettingsCategory`，新增 `suppliers` 分类，保持现有事件 API 不变。
- Modify: `src/components/SettingsDialog.tsx`
  - 接入左侧“供应商”菜单项，移除旧的内嵌 `CustomProviderSection`，维护新增/编辑/删除弹窗状态，并将供应商操作改为即时写入 store。
- Create: `src/components/settings/BuiltinProviderSettingsSection.tsx`
  - 承接原 `providers` 页里的内置供应商 API Key 配置与 GRSAI 模型选择区域，不再包含自定义供应商表单。
- Create: `src/components/settings/CustomProvidersPage.tsx`
  - 承接“供应商”页的标题、说明、顶部“添加供应商”按钮、空状态与列表行。
- Create: `src/components/settings/CustomProviderEditorDialog.tsx`
  - 承接新增/编辑供应商表单、字段校验、模型行编辑与保存回调。
- Create: `src/components/settings/DeleteProviderConfirmDialog.tsx`
  - 承接删除二次确认，不混入表单编辑逻辑。
- Modify: `src/features/canvas/ui/ModelParamsControls.tsx`
  - 区分内置供应商和自定义供应商缺配置时的设置跳转目标：内置跳 `providers`，自定义跳 `suppliers`。
- Modify: `src/features/canvas/ui/ModelParamsControls.test.tsx`
  - 增加自定义供应商缺配置时跳转 `suppliers` 的测试，并保留内置供应商跳转 `providers` 的断言。
- Create: `src/components/SettingsDialog.test.tsx`
  - 验证设置页左侧存在“API 配置”与“供应商”两个入口，并切换到正确内容区。
- Create: `src/components/settings/CustomProvidersPage.test.tsx`
  - 验证供应商列表、空状态、添加按钮和列表行操作按钮。
- Create: `src/components/settings/CustomProviderEditorDialog.test.tsx`
  - 验证新增/编辑弹窗的字段、校验、保存与关闭行为。
- Create: `src/components/settings/DeleteProviderConfirmDialog.test.tsx`
  - 验证删除二次确认逻辑。
- Create: `src/test/i18n.settings.test.ts`
  - 验证本次新增供应商管理文案在 `zh/en` 两套语言文件中同时存在。
- Modify: `src/i18n/locales/zh.json`
  - 新增“供应商”页、弹窗、删除确认、空状态、列表摘要、按钮文案。
- Modify: `src/i18n/locales/en.json`
  - 同步英文文案，保证 key 完整对齐。

## Task 1: 拆分设置分类并提取内置 API 配置页

**Files:**
- Create: `src/components/settings/BuiltinProviderSettingsSection.tsx`
- Create: `src/components/SettingsDialog.test.tsx`
- Modify: `src/components/SettingsDialog.tsx`
- Modify: `src/features/settings/settingsEvents.ts`

- [x] **Step 1: 先写设置页分类切换的失败测试**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SettingsDialog } from './SettingsDialog';
import { useSettingsStore } from '@/stores/settingsStore';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh-CN' },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('0.0.0-test'),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('remark-gfm', () => ({ default: [] }));
vi.mock('remark-breaks', () => ({ default: [] }));
vi.mock('../../docs/settings/provider-guide.md?raw', () => ({ default: '# guide' }));

vi.mock('@/components/settings/BuiltinProviderSettingsSection', () => ({
  BuiltinProviderSettingsSection: () => <div>builtin-provider-settings</div>,
}));

vi.mock('@/components/settings/CustomProvidersPage', () => ({
  CustomProvidersPage: () => <div>custom-providers-page</div>,
}));

describe('SettingsDialog', () => {
  it('separates built-in api config and custom suppliers', async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ hideProviderGuidePopover: true });

    render(<SettingsDialog isOpen onClose={vi.fn()} initialCategory="providers" />);

    expect(screen.getByRole('button', { name: 'settings.providers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.suppliers' })).toBeInTheDocument();
    expect(screen.getByText('builtin-provider-settings')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'settings.suppliers' }));

    expect(screen.getByText('custom-providers-page')).toBeInTheDocument();
  });
});
```

- [x] **Step 2: 运行测试，确认当前实现会失败**

Run: `npm exec vitest run src/components/SettingsDialog.test.tsx`

Expected:

```text
FAIL  src/components/SettingsDialog.test.tsx
+ Unable to find role="button" and name "settings.suppliers"
```

- [x] **Step 3: 扩展设置分类事件，允许 `suppliers` 作为合法入口**

```ts
export type SettingsCategory =
  | 'providers'
  | 'suppliers'
  | 'pricing'
  | 'appearance'
  | 'general'
  | 'experimental'
  | 'about';
```

- [x] **Step 4: 提取内置 API 配置组件，并在设置页接入独立“供应商”分类**

```tsx
// src/components/settings/BuiltinProviderSettingsSection.tsx
import { Eye, EyeOff } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

import { UiSelect } from '@/components/ui';
import { GRSAI_NANO_BANANA_PRO_MODEL_OPTIONS } from '@/features/canvas/models/providers/grsai';

interface BuiltinProviderSettingsSectionProps {
  providers: ReturnType<typeof import('@/features/canvas/models').listModelProviders>;
  localApiKeys: Record<string, string>;
  revealedApiKeys: Record<string, boolean>;
  localGrsaiNanoBananaProModel: string;
  onApiKeyChange: (providerId: string, value: string) => void;
  onToggleReveal: (providerId: string) => void;
  onGrsaiModelChange: (value: string) => void;
  registerUrls: Record<string, string>;
  getKeyUrls: Record<string, string>;
}

export function BuiltinProviderSettingsSection(props: BuiltinProviderSettingsSectionProps) {
  const { t, i18n } = useTranslation();

  return (
    <>
      <div className="px-6 py-5 border-b border-border-dark">
        <h2 className="text-lg font-semibold text-text-dark">{t('settings.providers')}</h2>
        <p className="mt-1 text-sm text-text-muted">{t('settings.providersDesc')}</p>
      </div>

      <div className="ui-scrollbar flex-1 space-y-4 overflow-y-auto p-6">
        {props.providers.map((provider) => {
          const displayName = i18n.language.startsWith('zh') ? provider.label : provider.name;
          const isRevealed = Boolean(props.revealedApiKeys[provider.id]);

          return (
            <div key={provider.id} className="rounded-lg border border-border-dark bg-bg-dark p-4">
              <div className="mb-3">
                <h3 className="text-sm font-medium text-text-dark">{displayName}</h3>
                {props.registerUrls[provider.id] && props.getKeyUrls[provider.id] ? (
                  <p className="text-xs text-text-muted">
                    {t('settings.providerApiKeyGuidePrefix')}{' '}
                    <a href={props.registerUrls[provider.id]} className="text-accent hover:underline">
                      {t('settings.providerRegisterLink')}
                    </a>
                    {t('settings.providerApiKeyGuideMiddle')}{' '}
                    <a href={props.getKeyUrls[provider.id]} className="text-accent hover:underline">
                      {t('settings.getApiKeyLink')}
                    </a>
                  </p>
                ) : (
                  <p className="text-xs text-text-muted">{provider.id}</p>
                )}
              </div>

              <div className="relative">
                <input
                  type={isRevealed ? 'text' : 'password'}
                  value={props.localApiKeys[provider.id] ?? ''}
                  onChange={(event) => props.onApiKeyChange(provider.id, event.target.value)}
                  placeholder={t('settings.enterApiKey')}
                  className="w-full rounded border border-border-dark bg-surface-dark px-3 py-2 pr-10 text-sm text-text-dark"
                />
                <button
                  type="button"
                  onClick={() => props.onToggleReveal(provider.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-bg-dark"
                >
                  {isRevealed ? <EyeOff className="h-4 w-4 text-text-muted" /> : <Eye className="h-4 w-4 text-text-muted" />}
                </button>
              </div>

              {provider.id === 'grsai' && (
                <UiSelect
                  value={props.localGrsaiNanoBananaProModel}
                  onChange={(event) => props.onGrsaiModelChange(event.target.value)}
                  className="mt-3 h-9 text-sm"
                >
                  {GRSAI_NANO_BANANA_PRO_MODEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </UiSelect>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
```

```tsx
// src/components/SettingsDialog.tsx
const [activeCategory, setActiveCategory] = useState<SettingsCategory>(initialCategory);

<button onClick={() => setActiveCategory('providers')}>
  <span className="text-sm">{t('settings.providers')}</span>
</button>
<button onClick={() => setActiveCategory('suppliers')}>
  <span className="text-sm">{t('settings.suppliers')}</span>
</button>

{activeCategory === 'providers' && (
  <BuiltinProviderSettingsSection
    providers={providers}
    localApiKeys={localApiKeys}
    revealedApiKeys={revealedApiKeys}
    localGrsaiNanoBananaProModel={localGrsaiNanoBananaProModel}
    onApiKeyChange={(providerId, value) =>
      setLocalApiKeys((previous) => ({ ...previous, [providerId]: value }))
    }
    onToggleReveal={(providerId) =>
      setRevealedApiKeys((previous) => ({ ...previous, [providerId]: !previous[providerId] }))
    }
    onGrsaiModelChange={setLocalGrsaiNanoBananaProModel}
    registerUrls={PROVIDER_REGISTER_URLS}
    getKeyUrls={PROVIDER_GET_KEY_URLS}
  />
)}
```

- [x] **Step 5: 重新运行设置页测试，确认分类拆分通过**

Run: `npm exec vitest run src/components/SettingsDialog.test.tsx`

Expected:

```text
PASS  src/components/SettingsDialog.test.tsx
+ 1 passed
```

- [ ] **Step 6: 提交本任务**

```bash
git add src/features/settings/settingsEvents.ts src/components/SettingsDialog.tsx src/components/settings/BuiltinProviderSettingsSection.tsx src/components/SettingsDialog.test.tsx
git commit -m "feat: split settings categories for supplier management"
```

## Task 2: 实现供应商列表页与新增/编辑弹窗

**Files:**
- Create: `src/components/settings/CustomProvidersPage.tsx`
- Create: `src/components/settings/CustomProvidersPage.test.tsx`
- Create: `src/components/settings/CustomProviderEditorDialog.tsx`
- Create: `src/components/settings/CustomProviderEditorDialog.test.tsx`
- Modify: `src/components/SettingsDialog.tsx`

- [x] **Step 1: 先写供应商列表页的失败测试**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CustomProvidersPage } from './CustomProvidersPage';
import type { CustomProviderConfig } from '@/stores/customProviderConfig';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const providers: CustomProviderConfig[] = [
  {
    id: 'gateway-a',
    name: '公司网关',
    protocol: 'openapi',
    baseUrl: 'https://sg2c.dchai.cn/v1',
    apiKey: 'token-1',
    models: [
      {
        id: 'model-main',
        displayName: 'Nano Banana Pro 2K',
        remoteModelId: 'Nano_Banana_Pro_2K_0',
        enabled: true,
      },
    ],
  },
];

describe('CustomProvidersPage', () => {
  it('renders list rows and forwards add/edit/delete actions', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <CustomProvidersPage
        providers={providers}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('公司网关')).toBeInTheDocument();
    expect(screen.getByText('Nano Banana Pro 2K')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'settings.addSupplier' }));
    await user.click(screen.getByRole('button', { name: 'common.edit' }));
    await user.click(screen.getByRole('button', { name: 'common.delete' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith('gateway-a');
    expect(onDelete).toHaveBeenCalledWith('gateway-a');
  });
});
```

- [x] **Step 2: 运行列表页测试，确认当前实现失败**

Run: `npm exec vitest run src/components/settings/CustomProvidersPage.test.tsx`

Expected:

```text
FAIL  src/components/settings/CustomProvidersPage.test.tsx
+ Cannot find module './CustomProvidersPage'
```

- [x] **Step 3: 实现供应商列表页，展示标题、空状态、模型摘要与操作按钮**

```tsx
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CustomProviderConfig } from '@/stores/customProviderConfig';
import { UiButton } from '@/components/ui';

interface CustomProvidersPageProps {
  providers: CustomProviderConfig[];
  onAdd: () => void;
  onEdit: (providerId: string) => void;
  onDelete: (providerId: string) => void;
}

function buildModelSummary(provider: CustomProviderConfig, emptyLabel: string): string {
  const enabledModels = provider.models.filter((model) => model.enabled);
  if (enabledModels.length === 0) {
    return emptyLabel;
  }

  const names = enabledModels.map((model) => model.displayName);
  return names.join('、');
}

export function CustomProvidersPage({
  providers,
  onAdd,
  onEdit,
  onDelete,
}: CustomProvidersPageProps) {
  const { t } = useTranslation();
  const sortedProviders = useMemo(
    () => [...providers].sort((left, right) => left.name.localeCompare(right.name)),
    [providers]
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-border-dark px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-text-dark">{t('settings.suppliers')}</h2>
          <p className="mt-1 text-sm text-text-muted">{t('settings.suppliersDesc')}</p>
        </div>
        <UiButton type="button" variant="primary" size="sm" onClick={onAdd}>
          {t('settings.addSupplier')}
        </UiButton>
      </div>

      <div className="ui-scrollbar flex-1 space-y-3 overflow-y-auto p-6">
        {sortedProviders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-dark px-4 py-8 text-sm text-text-muted">
            {t('settings.customProvidersEmpty')}
          </div>
        ) : (
          sortedProviders.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border-dark bg-bg-dark p-4"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-text-dark">{provider.name}</div>
                <div className="mt-1 truncate text-xs text-text-muted">
                  {buildModelSummary(provider, t('settings.customProviderNoEnabledModels'))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <UiButton type="button" size="sm" variant="muted" onClick={() => onEdit(provider.id)}>
                  {t('common.edit')}
                </UiButton>
                <UiButton type="button" size="sm" variant="ghost" onClick={() => onDelete(provider.id)}>
                  {t('common.delete')}
                </UiButton>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
```

- [x] **Step 4: 先写新增/编辑弹窗的失败测试**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CustomProviderEditorDialog } from './CustomProviderEditorDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('CustomProviderEditorDialog', () => {
  it('blocks invalid drafts and saves valid provider drafts', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <CustomProviderEditorDialog
        isOpen
        mode="create"
        initialProvider={null}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: 'common.save' }));
    expect(onSave).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('settings.customProviderName'), '公司网关');
    await user.type(screen.getByLabelText('settings.customProviderBaseUrl'), 'https://sg2c.dchai.cn/v1');
    await user.type(screen.getByLabelText('settings.customProviderApiKey'), 'token-1');
    await user.type(screen.getByLabelText('settings.customProviderModelName'), 'Nano Banana Pro 2K');
    await user.type(screen.getByLabelText('settings.customProviderModelId'), 'Nano_Banana_Pro_2K_0');
    await user.click(screen.getByRole('button', { name: 'common.save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].name).toBe('公司网关');
  });
});
```

- [x] **Step 5: 运行弹窗测试，确认当前实现失败**

Run: `npm exec vitest run src/components/settings/CustomProviderEditorDialog.test.tsx`

Expected:

```text
FAIL  src/components/settings/CustomProviderEditorDialog.test.tsx
+ Cannot find module './CustomProviderEditorDialog'
```

- [x] **Step 6: 实现新增/编辑弹窗，复用现有校验与模型草稿结构**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { UiButton, UiCheckbox, UiInput, UiModal, UiSelect } from '@/components/ui';
import {
  createCustomProviderDraft,
  createCustomProviderModelDraft,
  validateCustomProviders,
  type CustomProviderConfig,
} from '@/stores/customProviderConfig';

interface CustomProviderEditorDialogProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialProvider: CustomProviderConfig | null;
  onClose: () => void;
  onSave: (provider: CustomProviderConfig) => void;
}

function cloneProvider(provider: CustomProviderConfig): CustomProviderConfig {
  return {
    ...provider,
    models: provider.models.map((model) => ({ ...model })),
  };
}

export function CustomProviderEditorDialog({
  isOpen,
  mode,
  initialProvider,
  onClose,
  onSave,
}: CustomProviderEditorDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CustomProviderConfig>(createCustomProviderDraft());
  const [revealedApiKey, setRevealedApiKey] = useState(false);
  const validationErrors = useMemo(() => validateCustomProviders([draft]), [draft]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraft(initialProvider ? cloneProvider(initialProvider) : createCustomProviderDraft());
    setRevealedApiKey(false);
  }, [initialProvider, isOpen]);

  const handleSave = () => {
    if (validationErrors.length > 0) {
      return;
    }

    onSave(draft);
    onClose();
  };

  return (
    <UiModal
      isOpen={isOpen}
      title={mode === 'create' ? t('settings.addSupplier') : t('settings.editSupplier')}
      onClose={onClose}
      widthClassName="w-[720px]"
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
      <div className="space-y-4">
        <label className="space-y-1">
          <span className="text-xs font-medium text-text-dark">{t('settings.customProviderName')}</span>
          <UiInput
            aria-label={t('settings.customProviderName')}
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-text-dark">{t('settings.customProviderProtocol')}</span>
          <UiSelect
            aria-label={t('settings.customProviderProtocol')}
            value={draft.protocol}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                protocol: event.target.value as CustomProviderConfig['protocol'],
              }))
            }
          >
            <option value="openapi">{t('settings.customProviderProtocolOpenapi')}</option>
          </UiSelect>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-text-dark">{t('settings.customProviderBaseUrl')}</span>
          <UiInput
            aria-label={t('settings.customProviderBaseUrl')}
            value={draft.baseUrl}
            onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-text-dark">{t('settings.customProviderApiKey')}</span>
          <div className="relative">
            <UiInput
              aria-label={t('settings.customProviderApiKey')}
              type={revealedApiKey ? 'text' : 'password'}
              value={draft.apiKey}
              onChange={(event) => setDraft((current) => ({ ...current, apiKey: event.target.value }))}
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-bg-dark"
              onClick={() => setRevealedApiKey((current) => !current)}
            >
              {revealedApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <div className="space-y-3 rounded-lg border border-border-dark bg-bg-dark/60 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-text-dark">{t('settings.customProviderModels')}</div>
            <UiButton
              type="button"
              size="sm"
              variant="ghost"
              className="gap-2"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  models: [...current.models, createCustomProviderModelDraft()],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              {t('settings.addCustomProviderModel')}
            </UiButton>
          </div>

          {draft.models.map((model) => (
            <div key={model.id} className="space-y-3 rounded-lg border border-border-dark bg-surface-dark p-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-text-dark">{t('settings.customProviderModelName')}</span>
                <UiInput
                  aria-label={t('settings.customProviderModelName')}
                  value={model.displayName}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      models: current.models.map((item) =>
                        item.id === model.id ? { ...item, displayName: event.target.value } : item
                      ),
                    }))
                  }
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-text-dark">{t('settings.customProviderModelId')}</span>
                <UiInput
                  aria-label={t('settings.customProviderModelId')}
                  value={model.remoteModelId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      models: current.models.map((item) =>
                        item.id === model.id ? { ...item, remoteModelId: event.target.value } : item
                      ),
                    }))
                  }
                />
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-border-dark bg-bg-dark/60 px-3 py-2">
                <UiCheckbox
                  checked={model.enabled}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      models: current.models.map((item) =>
                        item.id === model.id ? { ...item, enabled: checked } : item
                      ),
                    }))
                  }
                />
                <span className="text-xs text-text-dark">{t('settings.customProviderModelEnabled')}</span>
              </label>

              <UiButton
                type="button"
                size="sm"
                variant="ghost"
                className="gap-2 text-text-muted"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    models: current.models.filter((item) => item.id !== model.id),
                  }))
                }
              >
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </UiButton>
            </div>
          ))}
        </div>
      </div>
    </UiModal>
  );
}
```

- [x] **Step 7: 在设置页中接入新增/编辑弹窗，并改为即时写入 `customProviders`**

```tsx
const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
const [isCreateProviderOpen, setCreateProviderOpen] = useState(false);

const editingProvider = useMemo(
  () => customProviders.find((provider) => provider.id === editingProviderId) ?? null,
  [customProviders, editingProviderId]
);

const handleSaveProvider = useCallback(
  (providerDraft: CustomProviderConfig) => {
    const exists = customProviders.some((provider) => provider.id === providerDraft.id);
    const nextProviders = exists
      ? customProviders.map((provider) => (provider.id === providerDraft.id ? providerDraft : provider))
      : [...customProviders, providerDraft];
    setCustomProviders(nextProviders);
    setCreateProviderOpen(false);
    setEditingProviderId(null);
  },
  [customProviders, setCustomProviders]
);

{activeCategory === 'suppliers' && (
  <CustomProvidersPage
    providers={customProviders}
    onAdd={() => setCreateProviderOpen(true)}
    onEdit={setEditingProviderId}
    onDelete={setPendingDeleteProviderId}
  />
)}

<CustomProviderEditorDialog
  isOpen={isCreateProviderOpen || Boolean(editingProvider)}
  mode={editingProvider ? 'edit' : 'create'}
  initialProvider={editingProvider}
  onClose={() => {
    setCreateProviderOpen(false);
    setEditingProviderId(null);
  }}
  onSave={handleSaveProvider}
/>
```

- [x] **Step 8: 运行列表页和弹窗测试，确认供应商页面主流程通过**

Run: `npm exec vitest run src/components/settings/CustomProvidersPage.test.tsx src/components/settings/CustomProviderEditorDialog.test.tsx`

Expected:

```text
PASS  src/components/settings/CustomProvidersPage.test.tsx
PASS  src/components/settings/CustomProviderEditorDialog.test.tsx
+ 2 passed
```

- [ ] **Step 9: 提交本任务**

```bash
git add src/components/SettingsDialog.tsx src/components/settings/CustomProvidersPage.tsx src/components/settings/CustomProvidersPage.test.tsx src/components/settings/CustomProviderEditorDialog.tsx src/components/settings/CustomProviderEditorDialog.test.tsx
git commit -m "feat: add custom supplier list and editor dialogs"
```

## Task 3: 接入删除确认与生图侧设置跳转联动

**Files:**
- Create: `src/components/settings/DeleteProviderConfirmDialog.tsx`
- Create: `src/components/settings/DeleteProviderConfirmDialog.test.tsx`
- Modify: `src/components/SettingsDialog.tsx`
- Modify: `src/features/canvas/ui/ModelParamsControls.tsx`
- Modify: `src/features/canvas/ui/ModelParamsControls.test.tsx`

- [x] **Step 1: 先写删除确认弹窗的失败测试**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeleteProviderConfirmDialog } from './DeleteProviderConfirmDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      key === 'settings.deleteSupplierConfirm'
        ? `settings.deleteSupplierConfirm:${params?.name ?? ''}`
        : key,
  }),
}));

describe('DeleteProviderConfirmDialog', () => {
  it('requires explicit confirmation before delete', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <DeleteProviderConfirmDialog
        isOpen
        providerName="公司网关"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('settings.deleteSupplierConfirm:公司网关')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'settings.confirmDeleteSupplier' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

- [x] **Step 2: 运行删除确认测试，确认当前实现失败**

Run: `npm exec vitest run src/components/settings/DeleteProviderConfirmDialog.test.tsx`

Expected:

```text
FAIL  src/components/settings/DeleteProviderConfirmDialog.test.tsx
+ Cannot find module './DeleteProviderConfirmDialog'
```

- [x] **Step 3: 实现删除确认弹窗，并在设置页接入二次确认后删除**

```tsx
import { useTranslation } from 'react-i18next';

import { UiButton, UiModal } from '@/components/ui';

interface DeleteProviderConfirmDialogProps {
  isOpen: boolean;
  providerName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteProviderConfirmDialog({
  isOpen,
  providerName,
  onClose,
  onConfirm,
}: DeleteProviderConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <UiModal
      isOpen={isOpen}
      title={t('settings.deleteSupplierTitle')}
      onClose={onClose}
      widthClassName="w-[420px]"
      footer={(
        <>
          <UiButton variant="muted" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </UiButton>
          <UiButton variant="primary" size="sm" onClick={onConfirm}>
            {t('settings.confirmDeleteSupplier')}
          </UiButton>
        </>
      )}
    >
      <p className="text-sm text-text-muted">
        {t('settings.deleteSupplierConfirm', { name: providerName })}
      </p>
    </UiModal>
  );
}
```

```tsx
const [pendingDeleteProviderId, setPendingDeleteProviderId] = useState<string | null>(null);

const pendingDeleteProvider = useMemo(
  () => customProviders.find((provider) => provider.id === pendingDeleteProviderId) ?? null,
  [customProviders, pendingDeleteProviderId]
);

const handleConfirmDeleteProvider = useCallback(() => {
  if (!pendingDeleteProviderId) {
    return;
  }

  setCustomProviders(customProviders.filter((provider) => provider.id !== pendingDeleteProviderId));
  setPendingDeleteProviderId(null);
}, [customProviders, pendingDeleteProviderId, setCustomProviders]);

<DeleteProviderConfirmDialog
  isOpen={Boolean(pendingDeleteProvider)}
  providerName={pendingDeleteProvider?.name ?? ''}
  onClose={() => setPendingDeleteProviderId(null)}
  onConfirm={handleConfirmDeleteProvider}
/>
```

- [x] **Step 4: 先给模型面板写“缺配置跳到 suppliers”的失败测试**

```tsx
it('opens suppliers settings for missing custom provider credentials', async () => {
  const user = userEvent.setup();
  const customModel = createRuntimeModel({
    id: 'custom-openapi:gateway-a:model-main',
    displayName: 'Nano Banana Pro 2K',
    providerId: 'custom-provider:gateway-a',
    runtimeProvider: {
      kind: 'custom-openapi',
      providerProfileId: 'gateway-a',
      providerDisplayName: '公司网关',
      protocol: 'openapi',
      baseUrl: '',
      apiKey: '',
      remoteModelId: 'Nano_Banana_Pro_2K_0',
    },
    supportsResolutionSelection: false,
  });

  render(
    <ModelParamsControls
      imageModels={[customModel]}
      selectedModel={customModel}
      resolutionOptions={[{ value: '1K', label: '1K' }]}
      selectedResolution={{ value: '1K', label: '1K' }}
      selectedAspectRatio={{ value: '1:1', label: '1:1' }}
      aspectRatioOptions={[{ value: '1:1', label: '1:1' }]}
      onModelChange={vi.fn()}
      onResolutionChange={vi.fn()}
      onAspectRatioChange={vi.fn()}
    />
  );

  await user.click(screen.getByRole('button', { name: /Nano Banana Pro 2K/i }));
  await user.click(screen.getByRole('button', { name: '公司网关' }));
  await user.click(screen.getByRole('button', { name: 'modelParams.goConfigure' }));

  expect(openSettingsDialog).toHaveBeenCalledWith({ category: 'suppliers' });
});
```

- [x] **Step 5: 运行模型面板测试，确认当前实现失败**

Run: `npm exec vitest run src/features/canvas/ui/ModelParamsControls.test.tsx`

Expected:

```text
FAIL  src/features/canvas/ui/ModelParamsControls.test.tsx
+ expected "openSettingsDialog" to have been called with { category: 'suppliers' }
```

- [x] **Step 6: 在模型面板中记录缺配置供应商的跳转分类**

```tsx
import type { SettingsCategory } from '@/features/settings/settingsEvents';

interface ProviderOptionItem {
  id: string;
  label: string;
  configured: boolean;
  settingsCategory: SettingsCategory;
}

const providerOptions = useMemo<ProviderOptionItem[]>(() => {
  return uniqueProviders.map((model) => {
    if (model.runtimeProvider.kind === 'custom-openapi') {
      return {
        id: model.providerId,
        label: model.runtimeProvider.providerDisplayName ?? model.displayName,
        configured:
          Boolean(model.runtimeProvider.baseUrl?.trim()) &&
          Boolean(model.runtimeProvider.apiKey?.trim()),
        settingsCategory: 'suppliers',
      };
    }

    const provider = getModelProvider(model.providerId);
    return {
      id: provider.id,
      label: provider.label || provider.name,
      configured: Boolean(apiKeys[provider.id]?.trim()),
      settingsCategory: 'providers',
    };
  });
}, [apiKeys, imageModels]);

const [missingConfigProvider, setMissingConfigProvider] = useState<ProviderOptionItem | null>(null);

if (!provider.configured) {
  setOpenPanel(null);
  setMissingConfigProvider(provider);
  return;
}

openSettingsDialog({ category: missingConfigProvider?.settingsCategory ?? 'providers' });
```

- [x] **Step 7: 重新运行删除确认和模型面板测试**

Run: `npm exec vitest run src/components/settings/DeleteProviderConfirmDialog.test.tsx src/features/canvas/ui/ModelParamsControls.test.tsx`

Expected:

```text
PASS  src/components/settings/DeleteProviderConfirmDialog.test.tsx
PASS  src/features/canvas/ui/ModelParamsControls.test.tsx
+ 4 passed
```

- [ ] **Step 8: 提交本任务**

```bash
git add src/components/SettingsDialog.tsx src/components/settings/DeleteProviderConfirmDialog.tsx src/components/settings/DeleteProviderConfirmDialog.test.tsx src/features/canvas/ui/ModelParamsControls.tsx src/features/canvas/ui/ModelParamsControls.test.tsx
git commit -m "feat: confirm supplier deletion and route custom provider setup"
```

## Task 4: 补齐中英文文案并完成回归验证

**Files:**
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`
- Create: `src/test/i18n.settings.test.ts`
- Verify: `src/components/SettingsDialog.test.tsx`
- Verify: `src/components/settings/CustomProvidersPage.test.tsx`
- Verify: `src/components/settings/CustomProviderEditorDialog.test.tsx`
- Verify: `src/components/settings/DeleteProviderConfirmDialog.test.tsx`
- Verify: `src/features/canvas/ui/ModelParamsControls.test.tsx`

- [x] **Step 1: 先写语言文件完整性失败测试**

```ts
import { describe, expect, it } from 'vitest';

import zh from '@/i18n/locales/zh.json';
import en from '@/i18n/locales/en.json';

describe('settings locale parity', () => {
  it('contains supplier management keys in both locales', () => {
    expect(zh.settings.suppliers).toBeTypeOf('string');
    expect(zh.settings.addSupplier).toBeTypeOf('string');
    expect(zh.settings.deleteSupplierTitle).toBeTypeOf('string');
    expect(zh.settings.deleteSupplierConfirm).toContain('{{name}}');

    expect(en.settings.suppliers).toBeTypeOf('string');
    expect(en.settings.addSupplier).toBeTypeOf('string');
    expect(en.settings.deleteSupplierTitle).toBeTypeOf('string');
    expect(en.settings.deleteSupplierConfirm).toContain('{{name}}');
  });
});
```

- [x] **Step 2: 运行语言文件测试，确认当前缺少新 key**

Run: `npm exec vitest run src/test/i18n.settings.test.ts`

Expected:

```text
FAIL  src/test/i18n.settings.test.ts
+ Cannot read properties of undefined (reading 'suppliers')
```

- [x] **Step 3: 更新中英文文案，覆盖页面、弹窗、空状态、删除确认**

```json
// src/i18n/locales/zh.json
{
  "settings": {
    "providers": "API 配置",
    "providersDesc": "配置内置供应商的 API Key，并查看供应商接入说明。",
    "suppliers": "供应商",
    "suppliersDesc": "管理自定义 OpenAPI 兼容供应商及其模型。",
    "addSupplier": "添加供应商",
    "editSupplier": "编辑供应商",
    "deleteSupplierTitle": "删除供应商",
    "deleteSupplierConfirm": "确认删除供应商 {{name}} 吗？",
    "confirmDeleteSupplier": "确认删除",
    "customProviderNoEnabledModels": "暂无可用模型"
  }
}
```

```json
// src/i18n/locales/en.json
{
  "settings": {
    "providers": "API Config",
    "providersDesc": "Configure API keys for built-in providers and review integration guidance.",
    "suppliers": "Suppliers",
    "suppliersDesc": "Manage custom OpenAPI-compatible suppliers and their models.",
    "addSupplier": "Add Supplier",
    "editSupplier": "Edit Supplier",
    "deleteSupplierTitle": "Delete Supplier",
    "deleteSupplierConfirm": "Delete supplier {{name}}?",
    "confirmDeleteSupplier": "Delete",
    "customProviderNoEnabledModels": "No enabled models"
  }
}
```

- [x] **Step 4: 运行本次功能的定向测试集**

Run: `npm exec vitest run src/components/SettingsDialog.test.tsx src/components/settings/CustomProvidersPage.test.tsx src/components/settings/CustomProviderEditorDialog.test.tsx src/components/settings/DeleteProviderConfirmDialog.test.tsx src/features/canvas/ui/ModelParamsControls.test.tsx src/test/i18n.settings.test.ts`

Expected:

```text
PASS  src/components/SettingsDialog.test.tsx
PASS  src/components/settings/CustomProvidersPage.test.tsx
PASS  src/components/settings/CustomProviderEditorDialog.test.tsx
PASS  src/components/settings/DeleteProviderConfirmDialog.test.tsx
PASS  src/features/canvas/ui/ModelParamsControls.test.tsx
PASS  src/test/i18n.settings.test.ts
+ 6 passed
```

- [x] **Step 5: 运行类型检查，确认设置页拆分没有遗留类型错误**

Run: `npx tsc --noEmit`

Expected:

```text
[no output]
```

- [x] **Step 6: 运行前端构建，确认设置页和生图侧联动可打包**

Run: `npm run build`

Expected:

```text
vite v...
✓ built in ...
```

- [ ] **Step 7: 提交本任务**

```bash
git add src/i18n/locales/zh.json src/i18n/locales/en.json src/test/i18n.settings.test.ts
git commit -m "test: cover supplier settings regression and locales"
```

## Self-Review

### 1. Spec coverage

- “设置页左侧提供独立供应商入口”:
  - Task 1 覆盖 `settingsEvents.ts`、`SettingsDialog.tsx`、`SettingsDialog.test.tsx`
- “供应商页顶部有添加按钮，下面有列表，列表行显示供应商名称 + 可用模型 + 编辑/删除”:
  - Task 2 覆盖 `CustomProvidersPage.tsx`、`CustomProvidersPage.test.tsx`
- “点击添加/编辑弹出窗口并保存”:
  - Task 2 覆盖 `CustomProviderEditorDialog.tsx`、`CustomProviderEditorDialog.test.tsx`
- “删除需要二次确认”:
  - Task 3 覆盖 `DeleteProviderConfirmDialog.tsx`、`DeleteProviderConfirmDialog.test.tsx`
- “自定义供应商继续参与生图选择，且缺配置时跳到正确页面”:
  - Task 3 覆盖 `ModelParamsControls.tsx`、`ModelParamsControls.test.tsx`
- “中英文文案齐全”:
  - Task 4 覆盖 `zh.json`、`en.json`、`i18n.settings.test.ts`

已覆盖当前 OpenSpec 与用户确认的全部需求，没有遗漏删除确认和即时刷新要求。

### 2. Placeholder scan

- 未使用 `TODO`、`TBD`、`implement later`、`similar to task N`。
- 每个任务都给了具体文件路径、测试代码、命令和预期输出。
- 所有 UI 改动步骤都给出了组件接口或关键实现代码。

### 3. Type consistency

- 统一使用 `SettingsCategory = 'providers' | 'suppliers' | ...`
- 统一使用 `CustomProviderConfig` / `CustomProviderEditorDialogProps`
- 统一使用 `pendingDeleteProviderId` / `editingProviderId` 命名
- 统一使用 `settings.suppliers`、`settings.addSupplier`、`settings.deleteSupplierTitle` 等 i18n key

命名、跳转分类和值对象在全部任务中保持一致，可直接按顺序执行。
