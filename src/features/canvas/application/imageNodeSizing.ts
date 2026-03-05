import { parseAspectRatio } from './imageData';

export interface ImageNodeSize {
  width: number;
  height: number;
}

export interface ImageNodeMinSize {
  minWidth: number;
  minHeight: number;
}

function roundPositive(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.round(value));
}

export function resolveAspectRatioValue(aspectRatio: string): number {
  return Math.max(0.1, parseAspectRatio(aspectRatio));
}

export function resolveMinEdgeFittedSize(
  aspectRatio: string,
  constraints: ImageNodeMinSize
): ImageNodeSize {
  const ratio = resolveAspectRatioValue(aspectRatio);
  const minWidth = roundPositive(constraints.minWidth);
  const minHeight = roundPositive(constraints.minHeight);

  const widthFirst = {
    width: minWidth,
    height: roundPositive(minWidth / ratio),
  };
  const heightFirst = {
    width: roundPositive(minHeight * ratio),
    height: minHeight,
  };

  return widthFirst.width * widthFirst.height <= heightFirst.width * heightFirst.height
    ? widthFirst
    : heightFirst;
}

export function resolveResizeMinConstraintsByAspect(
  aspectRatio: string,
  constraints: ImageNodeMinSize
): ImageNodeMinSize {
  const ratio = resolveAspectRatioValue(aspectRatio);
  const minWidth = roundPositive(constraints.minWidth);
  const minHeight = roundPositive(constraints.minHeight);
  const threshold = minWidth / Math.max(1, minHeight);

  if (ratio >= threshold) {
    return { minWidth, minHeight: 1 };
  }

  return { minWidth: 1, minHeight };
}

export function resolveSizeInsideTargetBox(
  aspectRatio: string,
  target: ImageNodeSize
): ImageNodeSize {
  const ratio = resolveAspectRatioValue(aspectRatio);
  const targetWidth = roundPositive(target.width);
  const targetHeight = roundPositive(target.height);
  const targetRatio = targetWidth / Math.max(1, targetHeight);

  if (ratio >= targetRatio) {
    return {
      width: targetWidth,
      height: roundPositive(targetWidth / ratio),
    };
  }

  return {
    width: roundPositive(targetHeight * ratio),
    height: targetHeight,
  };
}

export function ensureAtLeastOneMinEdge(
  size: ImageNodeSize,
  constraints: ImageNodeMinSize
): ImageNodeSize {
  const minWidth = roundPositive(constraints.minWidth);
  const minHeight = roundPositive(constraints.minHeight);
  const width = roundPositive(size.width);
  const height = roundPositive(size.height);

  if (width >= minWidth || height >= minHeight) {
    return { width, height };
  }

  const widthScale = minWidth / Math.max(1, width);
  const heightScale = minHeight / Math.max(1, height);
  const scale = Math.min(widthScale, heightScale);

  return {
    width: roundPositive(width * scale),
    height: roundPositive(height * scale),
  };
}
