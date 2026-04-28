export type CustomProviderProtocol = 'openapi' | 'xais-task';

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

export interface XaisTaskConnectionConfig {
  submitBaseUrl: string;
  waitBaseUrl: string;
  assetBaseUrl: string;
  apiKey: string;
  defaultOutputFormat?: 'image/png' | 'image/jpeg';
}

export interface CustomProviderConnectionConfig {
  openapi?: OpenApiConnectionConfig;
  xaisTask?: XaisTaskConnectionConfig;
}

export interface CustomProviderConfig {
  id: string;
  name: string;
  protocol: CustomProviderProtocol;
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
  return value === 'xais-task' ? 'xais-task' : DEFAULT_PROTOCOL;
}

function normalizeOutputFormat(
  value: string | null | undefined
): XaisTaskConnectionConfig['defaultOutputFormat'] {
  return value === 'image/jpeg' ? 'image/jpeg' : 'image/png';
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

function normalizeXaisTaskConnection(
  provider: Partial<CustomProviderConfig> | Record<string, unknown>
): XaisTaskConnectionConfig {
  const xaisTask = (provider.connection as { xaisTask?: XaisTaskConnectionConfig } | undefined)
    ?.xaisTask;

  return {
    submitBaseUrl: normalizeBaseUrl(xaisTask?.submitBaseUrl),
    waitBaseUrl: normalizeBaseUrl(xaisTask?.waitBaseUrl),
    assetBaseUrl: normalizeBaseUrl(xaisTask?.assetBaseUrl),
    apiKey: trim(xaisTask?.apiKey),
    defaultOutputFormat: normalizeOutputFormat(xaisTask?.defaultOutputFormat),
  };
}

function normalizeConnection(
  provider: Partial<CustomProviderConfig> | Record<string, unknown>,
  protocol: CustomProviderProtocol
): CustomProviderConnectionConfig {
  if (protocol === 'xais-task') {
    return {
      xaisTask: normalizeXaisTaskConnection(provider),
    };
  }

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

export function resolveXaisTaskConnection(
  provider: Pick<CustomProviderConfig, 'connection'>
): XaisTaskConnectionConfig {
  return normalizeXaisTaskConnection(provider);
}

export function isCustomProviderConfigured(provider: CustomProviderConfig): boolean {
  const hasEnabledModel = provider.models.some((model) => model.enabled);
  if (!hasEnabledModel) {
    return false;
  }

  if (provider.protocol === 'xais-task') {
    const connection = resolveXaisTaskConnection(provider);
    return (
      connection.submitBaseUrl.length > 0 &&
      connection.waitBaseUrl.length > 0 &&
      connection.assetBaseUrl.length > 0 &&
      connection.apiKey.length > 0
    );
  }

  const connection = resolveOpenApiConnection(provider);
  return connection.baseUrl.length > 0 && connection.apiKey.length > 0;
}

export function normalizeCustomProviders(
  input: CustomProviderConfig[] | null | undefined
): CustomProviderConfig[] {
  const seen = new Set<string>();

  return (input ?? [])
    .map((provider) => {
      const protocol = normalizeProtocol(provider.protocol);
      const connection = normalizeConnection(provider, protocol);
      const openapiConnection = connection.openapi;

      return {
        id: normalizeConfigId(provider.id),
        name: trim(provider.name),
        protocol,
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

    if (provider.protocol === 'xais-task') {
      const xaisTask = resolveXaisTaskConnection(provider);
      if (!normalizeBaseUrl(xaisTask.submitBaseUrl)) {
        errors.push(`provider[${providerIndex}].connection.xaisTask.submitBaseUrl`);
      }
      if (!normalizeBaseUrl(xaisTask.waitBaseUrl)) {
        errors.push(`provider[${providerIndex}].connection.xaisTask.waitBaseUrl`);
      }
      if (!normalizeBaseUrl(xaisTask.assetBaseUrl)) {
        errors.push(`provider[${providerIndex}].connection.xaisTask.assetBaseUrl`);
      }
      if (!trim(xaisTask.apiKey)) {
        errors.push(`provider[${providerIndex}].connection.xaisTask.apiKey`);
      }
    } else {
      const openapi = resolveOpenApiConnection(provider);
      if (!normalizeBaseUrl(openapi.baseUrl)) {
        errors.push(`provider[${providerIndex}].baseUrl`);
      }
      if (!trim(openapi.apiKey)) {
        errors.push(`provider[${providerIndex}].apiKey`);
      }
    }

    if (!provider.models.some((model) => model.enabled)) {
      errors.push(`provider[${providerIndex}].models`);
    }
  });

  return errors;
}
