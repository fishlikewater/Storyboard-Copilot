import type { RuntimeProviderConfig } from '@/features/canvas/models';

import type { GenerateImagePayload } from './ports';

interface BuildNodeGeneratePayloadInput {
  prompt: string;
  requestModel: string;
  size: string;
  aspectRatio: string;
  referenceImages?: string[];
  extraParams?: Record<string, unknown>;
  providerRuntime?: RuntimeProviderConfig;
}

export function buildNodeGeneratePayload(
  input: BuildNodeGeneratePayloadInput
): GenerateImagePayload {
  return {
    prompt: input.prompt,
    model: input.requestModel,
    size: input.size,
    aspectRatio: input.aspectRatio,
    referenceImages: input.referenceImages,
    extraParams: input.extraParams,
    providerRuntime: input.providerRuntime,
  };
}
