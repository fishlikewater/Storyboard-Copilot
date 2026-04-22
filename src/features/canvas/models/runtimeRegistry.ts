import {
  DEFAULT_IMAGE_MODEL_ID,
  getImageModel,
  listImageModels,
  listModelProviders,
} from './registry';
import type {
  RuntimeImageModelDefinition,
  RuntimeModelProviderDefinition,
} from './types';
import {
  buildCustomProviderModelId,
  type CustomProviderConfig,
} from '@/stores/customProviderConfig';

const BUILTIN_PROVIDER_ORDER = ['kie', 'ppio', 'fal', 'grsai'];

export function buildCustomRuntimeProviderId(providerId: string): string {
  return `custom-provider:${providerId}`;
}

function sortProvidersByOrder<T extends { id: string }>(providers: T[]): T[] {
  const orderIndex = new Map(BUILTIN_PROVIDER_ORDER.map((id, index) => [id, index]));
  return providers.slice().sort((left, right) => {
    const leftIndex = orderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.id.localeCompare(right.id);
  });
}

export function listRuntimeModelProviders(
  customProviders: CustomProviderConfig[]
): RuntimeModelProviderDefinition[] {
  const builtins = sortProvidersByOrder(listModelProviders()).map((provider) => ({
    ...provider,
    runtimeKind: 'builtin' as const,
    configured: true,
  }));

  const customs = customProviders.map((provider) => ({
    id: buildCustomRuntimeProviderId(provider.id),
    name: provider.name,
    label: provider.name,
    runtimeKind: 'custom-openapi' as const,
    configured: provider.apiKey.trim().length > 0,
    providerProfileId: provider.id,
    protocol: provider.protocol,
  }));

  return [...builtins, ...customs];
}

export function listRuntimeImageModels(
  customProviders: CustomProviderConfig[]
): RuntimeImageModelDefinition[] {
  const builtins = listImageModels().map<RuntimeImageModelDefinition>((model) => ({
    ...model,
    runtimeProvider: {
      kind: 'builtin',
    },
    supportsResolutionSelection: true,
  }));

  const baseModel = getImageModel(DEFAULT_IMAGE_MODEL_ID);
  const customs = customProviders.flatMap((provider) =>
    provider.models
      .filter((model) => model.enabled)
      .map<RuntimeImageModelDefinition>((model) => ({
        ...baseModel,
        id: buildCustomProviderModelId(provider.id, model.id),
        displayName: model.displayName,
        providerId: buildCustomRuntimeProviderId(provider.id),
        description: `${provider.name} / ${model.remoteModelId}`,
        pricing: undefined,
        resolveRequest: ({ referenceImageCount }) => ({
          requestModel: buildCustomProviderModelId(provider.id, model.id),
          modeLabel: referenceImageCount > 0 ? '编辑模式' : '生成模式',
        }),
        runtimeProvider: {
          kind: 'custom-openapi',
          providerProfileId: provider.id,
          providerDisplayName: provider.name,
          protocol: provider.protocol,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          remoteModelId: model.remoteModelId,
        },
        supportsResolutionSelection: false,
      }))
  );

  return [...builtins, ...customs];
}

export function getRuntimeImageModel(
  modelId: string,
  customProviders: CustomProviderConfig[]
): RuntimeImageModelDefinition {
  const runtimeModels = listRuntimeImageModels(customProviders);
  return (
    runtimeModels.find((model) => model.id === modelId) ??
    runtimeModels.find((model) => model.id === DEFAULT_IMAGE_MODEL_ID)!
  );
}
