import {
  generateImage,
  getGenerateImageJob,
  submitGenerateImageJob,
  submitTextCompletionJob,
  getTextCompletionJob,
  submitVideoGenerationJob,
  getVideoGenerationJob,
} from '@/commands/ai';
import { imageUrlToDataUrl, persistImageLocally } from '@/features/canvas/application/imageData';

import type { AiGateway, GenerateImagePayload } from '../application/ports';

async function normalizeReferenceImages(payload: GenerateImagePayload): Promise<string[] | undefined> {
  const isCustomProvider = payload.providerRuntime?.kind === 'custom-provider';
  const isKieModel = payload.model.startsWith('kie/');
  const isFalModel = payload.model.startsWith('fal/');
  return payload.referenceImages
    ? await Promise.all(
      payload.referenceImages.map(async (imageUrl) =>
        isCustomProvider || isKieModel || isFalModel
          ? await imageUrlToDataUrl(imageUrl)
          : await persistImageLocally(imageUrl)
      )
    )
    : undefined;
}

export const tauriAiGateway: AiGateway = {
  generateImage: async (payload: GenerateImagePayload) => {
    const normalizedReferenceImages = await normalizeReferenceImages(payload);

    return await generateImage({
      prompt: payload.prompt,
      model: payload.model,
      size: payload.size,
      aspect_ratio: payload.aspectRatio,
      action: payload.action,
      reference_images: normalizedReferenceImages,
      extra_params: payload.extraParams,
      provider_runtime: payload.providerRuntime,
    });
  },
  submitGenerateImageJob: async (payload: GenerateImagePayload) => {
    const normalizedReferenceImages = await normalizeReferenceImages(payload);
    return await submitGenerateImageJob({
      prompt: payload.prompt,
      model: payload.model,
      size: payload.size,
      aspect_ratio: payload.aspectRatio,
      action: payload.action,
      reference_images: normalizedReferenceImages,
      extra_params: payload.extraParams,
      provider_runtime: payload.providerRuntime,
    });
  },
  getGenerateImageJob,
  submitTextCompletionJob: async (payload) => {
    return await submitTextCompletionJob({
      prompt: payload.prompt,
      model: payload.model,
      provider_runtime: payload.providerRuntime,
    });
  },
  getTextCompletionJob,
  submitVideoGenerationJob: async (payload) => {
    const isCustomProvider = payload.providerRuntime?.kind === 'custom-provider';
    const isKieModel = payload.model.startsWith('kie/');
    const isFalModel = payload.model.startsWith('fal/');
    const normalizedReferenceImages = payload.referenceImages
      ? await Promise.all(
        payload.referenceImages.map(async (imageUrl) =>
          isCustomProvider || isKieModel || isFalModel
            ? await imageUrlToDataUrl(imageUrl)
            : await persistImageLocally(imageUrl)
        )
      )
      : undefined;
    return await submitVideoGenerationJob({
      prompt: payload.prompt,
      model: payload.model,
      size: payload.size,
      aspect_ratio: payload.aspectRatio,
      reference_images: normalizedReferenceImages,
      provider_runtime: payload.providerRuntime,
    });
  },
  getVideoGenerationJob,
};
