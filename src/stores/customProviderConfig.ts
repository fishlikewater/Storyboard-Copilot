export type CustomProviderProtocol = 'openapi' | 'openai-image' | 'agnes';

export type CustomProviderMediaType = 'text' | 'image' | 'video';

export const CUSTOM_PROVIDER_MEDIA_TYPES: CustomProviderMediaType[] = ['text', 'image', 'video'];

export interface CustomProviderModelConfig {
  id: string;
  displayName: string;
  remoteModelId: string;
  enabled: boolean;
}

export interface OpenApiConnectionConfig {
  baseUrl: string;
  apiKey: string;
}

export interface CustomProviderConnectionConfig {
  openapi?: OpenApiConnectionConfig;
}

export interface CustomProviderConfig {
  id: string;
  name: string;
  protocol: CustomProviderProtocol;
  mediaType: CustomProviderMediaType;
  baseUrl: string;
  apiKey: string;
  connection?: CustomProviderConnectionConfig;
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

function preferTrimmed(
  primary: string | null | undefined,
  fallback: string | null | undefined
): string {
  const normalizedPrimary = trim(primary);
  return normalizedPrimary || trim(fallback);
}

function normalizeProtocol(value: string | null | undefined): CustomProviderProtocol {
  if (value === 'openai-image' || value === 'agnes') {
    return value;
  }

  return DEFAULT_PROTOCOL;
}

function normalizeOpenApiConnection(
  provider: Partial<CustomProviderConfig> | Record<string, unknown>
): OpenApiConnectionConfig {
  const openapi = (provider.connection as { openapi?: OpenApiConnectionConfig } | undefined)?.openapi;

  return {
    baseUrl: normalizeBaseUrl(
      preferTrimmed(openapi?.baseUrl, provider.baseUrl as string | undefined)
    ),
    apiKey: preferTrimmed(openapi?.apiKey, provider.apiKey as string | undefined),
  };
}

function normalizeConnection(
  provider: Partial<CustomProviderConfig> | Record<string, unknown>
): CustomProviderConnectionConfig {
  return {
    openapi: normalizeOpenApiConnection(provider),
  };
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
  const connection = {
    openapi: {
      baseUrl: '',
      apiKey: '',
    },
  } satisfies CustomProviderConnectionConfig;

  return {
    id: createDraftId('provider'),
    name: '',
    protocol: DEFAULT_PROTOCOL,
    mediaType: 'image',
    baseUrl: connection.openapi?.baseUrl ?? '',
    apiKey: connection.openapi?.apiKey ?? '',
    connection,
    models: [createCustomProviderModelDraft()],
  };
}

export function buildCustomProviderModelId(providerId: string, modelId: string): string {
  return `custom-provider:${normalizeConfigId(providerId)}:${normalizeConfigId(modelId)}`;
}

export function resolveOpenApiConnection(
  provider: Pick<CustomProviderConfig, 'baseUrl' | 'apiKey' | 'connection'>
): OpenApiConnectionConfig {
  return normalizeOpenApiConnection(provider);
}

export function isCustomProviderConfigured(provider: CustomProviderConfig): boolean {
  const hasEnabledModel = provider.models.some((model) => model.enabled);
  if (!hasEnabledModel) {
    return false;
  }

  const connection = resolveOpenApiConnection(provider);
  return connection.baseUrl.length > 0 && connection.apiKey.length > 0;
}

function normalizeMediaType(value: string | null | undefined): CustomProviderMediaType {
  if (value === 'text' || value === 'video') {
    return value;
  }
  return 'image';
}

export function normalizeCustomProviders(
  input: CustomProviderConfig[] | null | undefined
): CustomProviderConfig[] {
  const seen = new Set<string>();

  return (input ?? [])
    .filter((provider) => {
      const protocol = (provider as { protocol?: string }).protocol;
      return !protocol || protocol === 'openapi' || protocol === 'openai-image' || protocol === 'agnes';
    })
    .map((provider) => {
      const protocol = normalizeProtocol(provider.protocol);
      const mediaType = normalizeMediaType((provider as { mediaType?: string }).mediaType);
      const connection = normalizeConnection(provider);
      const openapiConnection = connection.openapi;

      return {
        id: normalizeConfigId(provider.id),
        name: trim(provider.name),
        protocol,
        mediaType,
        baseUrl: openapiConnection?.baseUrl ?? '',
        apiKey: openapiConnection?.apiKey ?? '',
        connection,
        models: normalizeModels(provider.models),
      };
    })
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

    const openapi = resolveOpenApiConnection(provider);
    if (!normalizeBaseUrl(openapi.baseUrl)) {
      errors.push(`provider[${providerIndex}].baseUrl`);
    }
    if (!trim(openapi.apiKey)) {
      errors.push(`provider[${providerIndex}].apiKey`);
    }

    if (!provider.models.some((model) => model.enabled)) {
      errors.push(`provider[${providerIndex}].models`);
    }
  });

  return errors;
}
