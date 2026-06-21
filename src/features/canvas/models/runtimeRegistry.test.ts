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
    protocol: 'openapi', mediaType: 'image',
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

const openAiImageProviders: CustomProviderConfig[] = [
  {
    id: 'openai-images',
    name: 'OpenAI Images',
    protocol: 'openai-image', mediaType: 'image',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-openai',
    connection: {
      openapi: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-openai',
      },
    },
    models: [
      {
        id: 'gpt-image',
        displayName: 'GPT Image',
        remoteModelId: 'gpt-image-1',
        enabled: true,
      },
    ],
  },
];

describe('runtimeRegistry', () => {
  it('lists custom providers without built-in API providers', () => {
    const providers = listRuntimeModelProviders(customProviders);

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      id: 'custom-provider:gateway-a',
      runtimeKind: 'custom-provider',
    });
  });

  it('creates runtime models only for enabled custom provider models', () => {
    const models = listRuntimeImageModels(customProviders);

    expect(models).toHaveLength(1);
    expect(models.some((model) => model.id === 'custom-provider:gateway-a:model-main')).toBe(true);
    expect(models.every((model) => model.runtimeProvider.kind === 'custom-provider')).toBe(true);
  });

  it('returns a supplier configuration placeholder when no supplier model is available', () => {
    const models = listRuntimeImageModels([]);
    const fallback = getRuntimeImageModel('kie/nano-banana-2', []);

    expect(models).toHaveLength(1);
    expect(models[0].runtimeProvider.kind).toBe('custom-provider');
    expect(fallback.id).toBe(models[0].id);
    expect(fallback.runtimeProvider.kind).toBe('custom-provider');
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

    const model = getRuntimeImageModel('custom-provider:gateway-a:model-main', editedProviders);

    expect(model.displayName).toBe('Nano Banana Pro 4K');
    expect(model.runtimeProvider.kind).toBe('custom-provider');
    expect(model.runtimeProvider.providerDisplayName).toBe('Renamed Gateway');
    expect(model.runtimeProvider.remoteModelId).toBe('Nano_Banana_Pro_4K_0');
  });

  it('falls back to the supplier placeholder when a custom model is disabled', () => {
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
      getRuntimeImageModel('custom-provider:gateway-a:model-main', disabledProviders).providerId
    ).toBe('custom-provider:__unconfigured__');
  });

  it('falls back to the first custom supplier model when custom id is missing', () => {
    expect(getRuntimeImageModel('custom-provider:missing:model', customProviders).providerId).toBe(
      'custom-provider:gateway-a'
    );
  });

  it('exposes openai-image runtime provider metadata', () => {
    const providers = listRuntimeModelProviders(openAiImageProviders);
    const runtimeModels = listRuntimeImageModels(openAiImageProviders);
    const openAiImageModel = runtimeModels.find(
      (model) => model.id === 'custom-provider:openai-images:gpt-image'
    );

    expect(providers[providers.length - 1]).toMatchObject({
      id: 'custom-provider:openai-images',
      runtimeKind: 'custom-provider',
      configured: true,
      protocol: 'openai-image',
    });
    expect(openAiImageModel?.runtimeProvider).toMatchObject({
      kind: 'custom-provider',
      protocol: 'openai-image',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-openai',
      remoteModelId: 'gpt-image-1',
    });
  });
});
