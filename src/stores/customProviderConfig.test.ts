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
        protocol: 'openapi', mediaType: 'image',
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
      protocol: 'openapi', mediaType: 'image',
      connection: {
        openapi: {
          baseUrl: 'https://sg2c.dchai.cn/v1',
          apiKey: 'token-1',
        },
      },
    });
  });

  it('drops unsupported legacy providers during normalization', () => {
    const providers = normalizeCustomProviders([
      {
        id: 'gateway-legacy',
        name: 'Legacy Gateway',
        protocol: 'legacy-task',
        connection: {
          legacyTask: {
            baseUrl: ' https://sg2c.dchai.cn/ ',
            apiKey: ' token-2 ',
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

    expect(providers).toEqual([]);
  });

  it('normalizes openai-image providers into openapi-style connection fields', () => {
    const providers = normalizeCustomProviders([
      {
        id: ' openai images ',
        name: ' OpenAI Images ',
        protocol: 'openai-image', mediaType: 'image',
        connection: {
          openapi: {
            baseUrl: ' https://api.openai.com/v1/ ',
            apiKey: ' sk-openai ',
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
      } as unknown as never,
    ]);

    expect(providers[0]).toMatchObject({
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
    });
  });

  it('builds stable internal ids for custom-provider models', () => {
    expect(buildCustomProviderModelId('gateway-a', 'model-main')).toBe(
      'custom-provider:gateway-a:model-main'
    );
  });

  it('reports missing openapi connection fields', () => {
    expect(
      validateCustomProviders([
        {
          id: 'gateway-openapi',
          name: 'OpenAPI Gateway',
          protocol: 'openapi', mediaType: 'image',
          baseUrl: '',
          apiKey: '',
          models: [],
        } as unknown as never,
      ])
    ).toEqual([
      'provider[0].baseUrl',
      'provider[0].apiKey',
      'provider[0].models',
    ]);
  });
});
