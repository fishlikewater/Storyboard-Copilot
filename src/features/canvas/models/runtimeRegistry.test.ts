import { describe, expect, it } from 'vitest';

import type { CustomProviderConfig } from '@/stores/customProviderConfig';

import {
  getRuntimeImageModel,
  listRuntimeImageModels,
  listRuntimeModelProviders,
} from './runtimeRegistry';

const customProviders: CustomProviderConfig[] = [
  {
    id: 'gateway-a',
    name: 'Acme Gateway',
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

describe('runtimeRegistry', () => {
  it('adds custom providers after built-in providers', () => {
    const providers = listRuntimeModelProviders(customProviders);
    const lastProvider = providers[providers.length - 1];

    expect(lastProvider?.id).toBe('custom-provider:gateway-a');
    expect(lastProvider?.runtimeKind).toBe('custom-openapi');
  });

  it('creates runtime models for enabled custom provider models', () => {
    const models = listRuntimeImageModels(customProviders);

    expect(models.some((model) => model.id === 'custom-openapi:gateway-a:model-main')).toBe(true);
  });

  it('returns edited runtime metadata for an existing custom model id', () => {
    const editedProviders: CustomProviderConfig[] = [
      {
        ...customProviders[0],
        name: 'Renamed Gateway',
        models: [
          {
            ...customProviders[0].models[0],
            displayName: 'Nano Banana Pro 4K',
            remoteModelId: 'Nano_Banana_Pro_4K_0',
          },
        ],
      },
    ];

    const model = getRuntimeImageModel('custom-openapi:gateway-a:model-main', editedProviders);

    expect(model.displayName).toBe('Nano Banana Pro 4K');
    expect(model.runtimeProvider.kind).toBe('custom-openapi');
    expect(model.runtimeProvider.providerDisplayName).toBe('Renamed Gateway');
    expect(model.runtimeProvider.remoteModelId).toBe('Nano_Banana_Pro_4K_0');
  });

  it('falls back to default built-in model when a custom model is disabled', () => {
    const disabledProviders: CustomProviderConfig[] = [
      {
        ...customProviders[0],
        models: [
          {
            ...customProviders[0].models[0],
            enabled: false,
          },
        ],
      },
    ];

    expect(
      getRuntimeImageModel('custom-openapi:gateway-a:model-main', disabledProviders).providerId
    ).toBe('kie');
  });

  it('falls back to default built-in model when custom id is missing', () => {
    expect(getRuntimeImageModel('custom-openapi:missing:model', customProviders).providerId).toBe(
      'kie'
    );
  });
});
