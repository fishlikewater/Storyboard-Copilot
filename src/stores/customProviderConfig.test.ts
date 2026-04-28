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
      } as unknown as never,
    ]);

    expect(providers[0].connection?.xaisTask).toEqual({
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
        } as unknown as never,
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
