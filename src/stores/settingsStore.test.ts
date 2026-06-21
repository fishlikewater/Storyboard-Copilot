import { describe, expect, it } from 'vitest';

import type { CustomProviderConfig } from './customProviderConfig';
import { getConfiguredProviderCount } from './settingsStore';

const configuredSupplier: CustomProviderConfig = {
  id: 'gateway-a',
  name: 'Gateway A',
  protocol: 'openapi', mediaType: 'image',
  baseUrl: 'https://example.com/v1',
  apiKey: 'supplier-token',
  models: [
    {
      id: 'model-a',
      displayName: 'Model A',
      remoteModelId: 'remote-model-a',
      enabled: true,
    },
  ],
};

describe('settingsStore provider configuration counting', () => {
  it('counts only configured suppliers', () => {
    expect(getConfiguredProviderCount([])).toBe(0);
    expect(getConfiguredProviderCount([configuredSupplier])).toBe(1);
  });
});
