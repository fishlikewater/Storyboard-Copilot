import { describe, expect, it } from 'vitest';

import {
  buildCustomProviderModelId,
  normalizeCustomProviders,
  validateCustomProviders,
} from './customProviderConfig';

describe('customProviderConfig', () => {
  it('builds stable internal model ids', () => {
    expect(buildCustomProviderModelId('gateway-a', 'model-main')).toBe(
      'custom-openapi:gateway-a:model-main'
    );
  });

  it('normalizes providers and removes invalid models', () => {
    const providers = normalizeCustomProviders([
      {
        id: ' gateway-a ',
        name: ' 公司网关 ',
        protocol: 'openapi',
        baseUrl: ' https://sg2c.dchai.cn/v1/ ',
        apiKey: '  token-1  ',
        models: [
          {
            id: ' model-main ',
            displayName: ' 主模型 ',
            remoteModelId: ' Nano_Banana_Pro_2K_0 ',
            enabled: true,
          },
          {
            id: 'broken',
            displayName: '   ',
            remoteModelId: '   ',
            enabled: true,
          },
        ],
      },
    ]);

    expect(providers).toEqual([
      {
        id: 'gateway-a',
        name: '公司网关',
        protocol: 'openapi',
        baseUrl: 'https://sg2c.dchai.cn/v1',
        apiKey: 'token-1',
        models: [
          {
            id: 'model-main',
            displayName: '主模型',
            remoteModelId: 'Nano_Banana_Pro_2K_0',
            enabled: true,
          },
        ],
      },
    ]);
  });

  it('reports validation errors for missing required fields', () => {
    expect(
      validateCustomProviders([
        {
          id: 'gateway-a',
          name: '',
          protocol: 'openapi',
          baseUrl: '',
          apiKey: '',
          models: [],
        },
      ])
    ).toEqual([
      'provider[0].name',
      'provider[0].baseUrl',
      'provider[0].apiKey',
      'provider[0].models',
    ]);
  });
});
