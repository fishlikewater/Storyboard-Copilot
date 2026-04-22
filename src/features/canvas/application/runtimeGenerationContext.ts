import type { RuntimeImageModelDefinition, RuntimeProviderConfig } from '@/features/canvas/models';
import type { ProviderApiKeys } from '@/stores/settingsStore';

export interface RuntimeGenerationContext {
  apiKey: string;
  isConfigured: boolean;
  shouldSetApiKey: boolean;
  resumeProviderId: string | null;
  providerRuntime?: RuntimeProviderConfig;
}

function trim(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export function resolveGenerationContext(
  model: RuntimeImageModelDefinition,
  apiKeys: ProviderApiKeys
): RuntimeGenerationContext {
  if (model.runtimeProvider.kind === 'custom-openapi') {
    const apiKey = trim(model.runtimeProvider.apiKey);
    const baseUrl = trim(model.runtimeProvider.baseUrl);
    const remoteModelId = trim(model.runtimeProvider.remoteModelId);
    const isConfigured = apiKey.length > 0 && baseUrl.length > 0 && remoteModelId.length > 0;

    return {
      apiKey,
      isConfigured,
      shouldSetApiKey: false,
      resumeProviderId: null,
      providerRuntime: isConfigured
        ? {
          ...model.runtimeProvider,
          apiKey,
          baseUrl,
          remoteModelId,
        }
        : undefined,
    };
  }

  const apiKey = trim(apiKeys[model.providerId]);
  return {
    apiKey,
    isConfigured: apiKey.length > 0,
    shouldSetApiKey: apiKey.length > 0,
    resumeProviderId: model.providerId,
  };
}
