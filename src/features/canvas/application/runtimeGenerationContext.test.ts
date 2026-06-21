import { describe, expect, it } from 'vitest';

import { getRuntimeImageModel } from '@/features/canvas/models';
import type { CustomProviderConfig } from '@/stores/customProviderConfig';

import { resolveGenerationContext } from './runtimeGenerationContext';

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

describe('runtimeGenerationContext', () => {
  it('ignores built-in API keys when resolving a legacy built-in model id', () => {
    const model = getRuntimeImageModel('kie/nano-banana-2', customProviders);
    const context = resolveGenerationContext(model);

    expect(context.isConfigured).toBe(true);
    expect(context.providerRuntime?.kind).toBe('custom-provider');
    expect(context.providerRuntime?.providerProfileId).toBe('gateway-a');
  });

  it('returns an unconfigured supplier context when no supplier model exists', () => {
    const model = getRuntimeImageModel('kie/nano-banana-2', []);
    const context = resolveGenerationContext(model);

    expect(context.isConfigured).toBe(false);
    expect(context.providerRuntime).toBeUndefined();
  });

  it('returns custom openapi runtime from supplier configuration', () => {
    const model = getRuntimeImageModel('custom-provider:gateway-a:model-main', customProviders);
    const context = resolveGenerationContext(model);

    expect(context.isConfigured).toBe(true);
    expect(context.providerRuntime?.kind).toBe('custom-provider');
    expect(context.providerRuntime?.remoteModelId).toBe('Nano_Banana_Pro_2K_0');
  });

  it('returns openai-image runtime from supplier configuration', () => {
    const model = getRuntimeImageModel('custom-provider:openai-images:gpt-image', openAiImageProviders);
    const context = resolveGenerationContext(model);

    expect(context.isConfigured).toBe(true);
    expect(context.providerRuntime).toMatchObject({
      kind: 'custom-provider',
      protocol: 'openai-image',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-openai',
      remoteModelId: 'gpt-image-1',
    });
  });
});
