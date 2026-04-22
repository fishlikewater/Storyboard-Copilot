import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RuntimeImageModelDefinition } from '@/features/canvas/models';
import { useSettingsStore } from '@/stores/settingsStore';

import { ModelParamsControls } from './ModelParamsControls';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/settings/settingsEvents', () => ({
  openSettingsDialog: vi.fn(),
}));

vi.mock('@/components/ui/useDialogTransition', () => ({
  useDialogTransition: (isOpen: boolean) => ({
    shouldRender: isOpen,
    isVisible: isOpen,
  }),
}));

function createRuntimeModel(
  overrides: Partial<RuntimeImageModelDefinition>
): RuntimeImageModelDefinition {
  return {
    id: 'kie/nano-banana-2',
    mediaType: 'image',
    displayName: 'Nano Banana 2',
    providerId: 'kie',
    description: 'built-in',
    eta: '1min',
    defaultAspectRatio: '1:1',
    defaultResolution: '1K',
    aspectRatios: [{ value: '1:1', label: '1:1' }],
    resolutions: [{ value: '1K', label: '1K' }],
    resolveRequest: () => ({
      requestModel: 'kie/nano-banana-2',
      modeLabel: '生成模式',
    }),
    runtimeProvider: {
      kind: 'builtin',
    },
    supportsResolutionSelection: true,
    ...overrides,
  };
}

describe('ModelParamsControls', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      apiKeys: {
        kie: 'kie-token',
      },
    });
  });

  afterEach(() => {
    useSettingsStore.setState({
      apiKeys: {},
    });
  });

  it('switches to the first model of the selected configured provider', async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();

    const builtInModel = createRuntimeModel({});
    const customModel = createRuntimeModel({
      id: 'custom-openapi:gateway-a:model-main',
      displayName: 'Nano Banana Pro 2K',
      providerId: 'custom-provider:gateway-a',
      description: 'custom',
      runtimeProvider: {
        kind: 'custom-openapi',
        providerProfileId: 'gateway-a',
        providerDisplayName: '公司网关',
        protocol: 'openapi',
        baseUrl: 'https://sg2c.dchai.cn/v1',
        apiKey: 'token-1',
        remoteModelId: 'Nano_Banana_Pro_2K_0',
      },
      supportsResolutionSelection: false,
    });

    render(
      <ModelParamsControls
        imageModels={[builtInModel, customModel]}
        selectedModel={builtInModel}
        resolutionOptions={[{ value: '1K', label: '1K' }]}
        selectedResolution={{ value: '1K', label: '1K' }}
        selectedAspectRatio={{ value: '1:1', label: '1:1' }}
        aspectRatioOptions={[{ value: '1:1', label: '1:1' }]}
        onModelChange={onModelChange}
        onResolutionChange={vi.fn()}
        onAspectRatioChange={vi.fn()}
      />
    );

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Nano Banana 2/i }));
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: '公司网关' }));
    });

    expect(onModelChange).toHaveBeenCalledWith('custom-openapi:gateway-a:model-main');
  });

  it('hides quality controls for custom openapi models', async () => {
    const user = userEvent.setup();

    const customModel = createRuntimeModel({
      id: 'custom-openapi:gateway-a:model-main',
      displayName: 'Nano Banana Pro 2K',
      providerId: 'custom-provider:gateway-a',
      description: 'custom',
      runtimeProvider: {
        kind: 'custom-openapi',
        providerProfileId: 'gateway-a',
        providerDisplayName: '公司网关',
        protocol: 'openapi',
        baseUrl: 'https://sg2c.dchai.cn/v1',
        apiKey: 'token-1',
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

    await act(async () => {
      await user.click(screen.getByRole('button', { name: '1:1' }));
    });

    expect(screen.queryByText('modelParams.quality')).not.toBeInTheDocument();
    expect(screen.getByText('modelParams.aspectRatio')).toBeInTheDocument();
  });
});
