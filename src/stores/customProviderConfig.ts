export type CustomProviderProtocol = 'openapi';

export interface CustomProviderModelConfig {
  id: string;
  displayName: string;
  remoteModelId: string;
  enabled: boolean;
}

export interface CustomProviderConfig {
  id: string;
  name: string;
  protocol: CustomProviderProtocol;
  baseUrl: string;
  apiKey: string;
  models: CustomProviderModelConfig[];
}

const DEFAULT_PROTOCOL: CustomProviderProtocol = 'openapi';

function trim(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function normalizeConfigId(value: string | null | undefined): string {
  return trim(value)
    .toLowerCase()
    .replace(/[:/\\]+/gu, '-')
    .replace(/\s+/gu, '-')
    .replace(/[^a-z0-9_-]+/gu, '')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function normalizeBaseUrl(value: string | null | undefined): string {
  return trim(value).replace(/\/+$/u, '');
}

function normalizeModels(
  models: CustomProviderModelConfig[] | null | undefined
): CustomProviderModelConfig[] {
  const seen = new Set<string>();

  return (models ?? [])
    .map((model) => ({
      id: normalizeConfigId(model.id),
      displayName: trim(model.displayName),
      remoteModelId: trim(model.remoteModelId),
      enabled: Boolean(model.enabled),
    }))
    .filter((model) => model.id && model.displayName && model.remoteModelId)
    .filter((model) => {
      if (seen.has(model.id)) {
        return false;
      }
      seen.add(model.id);
      return true;
    });
}

function createDraftId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCustomProviderModelDraft(): CustomProviderModelConfig {
  return {
    id: createDraftId('model'),
    displayName: '',
    remoteModelId: '',
    enabled: true,
  };
}

export function createCustomProviderDraft(): CustomProviderConfig {
  return {
    id: createDraftId('provider'),
    name: '',
    protocol: DEFAULT_PROTOCOL,
    baseUrl: '',
    apiKey: '',
    models: [createCustomProviderModelDraft()],
  };
}

export function buildCustomProviderModelId(providerId: string, modelId: string): string {
  return `custom-openapi:${normalizeConfigId(providerId)}:${normalizeConfigId(modelId)}`;
}

export function normalizeCustomProviders(
  input: CustomProviderConfig[] | null | undefined
): CustomProviderConfig[] {
  const seen = new Set<string>();

  return (input ?? [])
    .map((provider) => ({
      id: normalizeConfigId(provider.id),
      name: trim(provider.name),
      protocol: provider.protocol === 'openapi' ? provider.protocol : DEFAULT_PROTOCOL,
      baseUrl: normalizeBaseUrl(provider.baseUrl),
      apiKey: trim(provider.apiKey),
      models: normalizeModels(provider.models),
    }))
    .filter((provider) => provider.id && provider.name)
    .filter((provider) => {
      if (seen.has(provider.id)) {
        return false;
      }
      seen.add(provider.id);
      return true;
    });
}

export function validateCustomProviders(providers: CustomProviderConfig[]): string[] {
  const errors: string[] = [];

  providers.forEach((provider, providerIndex) => {
    if (!trim(provider.name)) {
      errors.push(`provider[${providerIndex}].name`);
    }
    if (!normalizeBaseUrl(provider.baseUrl)) {
      errors.push(`provider[${providerIndex}].baseUrl`);
    }
    if (!trim(provider.apiKey)) {
      errors.push(`provider[${providerIndex}].apiKey`);
    }
    if (!provider.models.some((model) => model.enabled)) {
      errors.push(`provider[${providerIndex}].models`);
    }
  });

  return errors;
}
