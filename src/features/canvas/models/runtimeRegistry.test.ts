import { describe, expect, it } from 'vitest';

import {
  getRuntimeImageModel,
  listRuntimeImageModels,
  listRuntimeModelProviders,
} from './runtimeRegistry';
import type { CustomProviderConfig } from '@/stores/customProviderConfig';

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

  it('falls back to default built-in model when custom id is missing', () => {
    expect(getRuntimeImageModel('custom-openapi:missing:model', customProviders).providerId).toBe(
      'kie'
    );
  });
});
