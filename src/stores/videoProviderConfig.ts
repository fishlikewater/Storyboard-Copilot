export type VideoProviderProtocol = 'agnes-video';

export interface VideoProviderModelConfig {
  id: string;
  displayName: string;
  remoteModelId: string;
  enabled: boolean;
}

export interface VideoProviderConfig {
  id: string;
  name: string;
  protocol: VideoProviderProtocol;
  baseUrl: string;
  apiKey: string;
  models: VideoProviderModelConfig[];
}

const DEFAULT_PROTOCOL: VideoProviderProtocol = 'agnes-video';
const DEFAULT_BASE_URL = 'https://apihub.agnes-ai.com';

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

let draftCounter = 0;

export function createVideoProviderModelDraft(
  overrides?: Partial<VideoProviderModelConfig>
): VideoProviderModelConfig {
  draftCounter += 1;
  return {
    id: `model-${Date.now()}-${draftCounter}`,
    displayName: '',
    remoteModelId: '',
    enabled: true,
    ...overrides,
  };
}

export function createVideoProviderDraft(
  overrides?: Partial<VideoProviderConfig>
): VideoProviderConfig {
  const id = `video-provider-${Date.now()}`;
  return {
    id,
    name: '',
    protocol: DEFAULT_PROTOCOL,
    baseUrl: DEFAULT_BASE_URL,
    apiKey: '',
    models: [
      createVideoProviderModelDraft({
        displayName: 'Agnes Video V2.0',
        remoteModelId: 'agnes-video-v2.0',
      }),
    ],
    ...overrides,
  };
}

export function normalizeVideoProviders(
  providers: VideoProviderConfig[]
): VideoProviderConfig[] {
  const seen = new Set<string>();

  return providers
    .map((provider) => {
      const protocol: VideoProviderProtocol =
        provider.protocol === 'agnes-video' ? provider.protocol : DEFAULT_PROTOCOL;

      return {
        ...provider,
        id: normalizeConfigId(provider.id),
        name: trim(provider.name),
        protocol,
        baseUrl: trim(provider.baseUrl),
        apiKey: trim(provider.apiKey),
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

function normalizeModels(
  models: VideoProviderModelConfig[]
): VideoProviderModelConfig[] {
  const seen = new Set<string>();

  return models
    .map((model) => {
      const id = normalizeConfigId(model.id) || `model-${Date.now()}`;
      return {
        ...model,
        id,
        displayName: trim(model.displayName) || 'Unnamed Model',
        remoteModelId: trim(model.remoteModelId),
      };
    })
    .filter((model) => {
      if (!model.remoteModelId) {
        return false;
      }
      if (seen.has(model.id)) {
        return false;
      }
      seen.add(model.id);
      return true;
    });
}

export function validateVideoProviders(providers: VideoProviderConfig[]): string[] {
  const errors: string[] = [];

  providers.forEach((provider, providerIndex) => {
    if (!trim(provider.name)) {
      errors.push(`provider[${providerIndex}].name`);
    }

    if (!trim(provider.baseUrl)) {
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
