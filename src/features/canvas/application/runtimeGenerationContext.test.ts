import { describe, expect, it } from 'vitest';

import { getRuntimeImageModel } from '@/features/canvas/models';
import type { CustomProviderConfig } from '@/stores/customProviderConfig';

import { resolveGenerationContext } from './runtimeGenerationContext';

const customProviders: CustomProviderConfig[] = [
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

describe('runtimeGenerationContext', () => {
  it('returns built-in provider context from apiKeys', () => {
    const model = getRuntimeImageModel('kie/nano-banana-2', customProviders);
    const context = resolveGenerationContext(model, {
      kie: 'built-in-token',
    });

    expect(context.isConfigured).toBe(true);
    expect(context.shouldSetApiKey).toBe(true);
    expect(context.resumeProviderId).toBe('kie');
    expect(context.providerRuntime).toBeUndefined();
  });

  it('returns custom openapi runtime without requiring set_api_key', () => {
    const model = getRuntimeImageModel('custom-openapi:gateway-a:model-main', customProviders);
    const context = resolveGenerationContext(model, {});

    expect(context.isConfigured).toBe(true);
    expect(context.shouldSetApiKey).toBe(false);
    expect(context.resumeProviderId).toBeNull();
    expect(context.providerRuntime?.remoteModelId).toBe('Nano_Banana_Pro_2K_0');
  });
});
