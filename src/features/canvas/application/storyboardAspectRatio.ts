import type { StoryboardRatioControlMode } from '@/features/canvas/domain/canvasNodes';

const DEFAULT_ASPECT_RATIO = '1:1';
const FRIENDLY_ASPECT_RATIO_CANDIDATES = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '21:9',
  '9:21',
  '3:2',
  '2:3',
  '5:4',
  '4:5',
];

function parseAspectRatioValue(aspectRatio: string): number {
  const [rawWidth = '1', rawHeight = '1'] = aspectRatio.split(':');
  const width = Number.parseFloat(rawWidth);
  const height = Number.parseFloat(rawHeight);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1;
  }

  return width / height;
}

function pickClosestAspectRatio(
  targetRatio: number,
  supportedAspectRatios: string[]
): string {
  const supported = supportedAspectRatios.length > 0 ? supportedAspectRatios : [DEFAULT_ASPECT_RATIO];
  let bestValue = supported[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const aspectRatio of supported) {
    const ratio = parseAspectRatioValue(aspectRatio);
    const distance = Math.abs(Math.log(ratio / targetRatio));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestValue = aspectRatio;
    }
  }

  return bestValue;
}

function ratioValueToAspectRatioString(ratioValue: number): string {
  if (!Number.isFinite(ratioValue) || ratioValue <= 0) {
    return DEFAULT_ASPECT_RATIO;
  }

  const scaledWidth = Math.max(1, Math.round(ratioValue * 1000));
  const scaledHeight = 1000;
  const gcd = (left: number, right: number): number => {
    let a = Math.abs(left);
    let b = Math.abs(right);
    while (b !== 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a || 1;
  };

  const divisor = gcd(scaledWidth, scaledHeight);
  return `${Math.round(scaledWidth / divisor)}:${Math.round(scaledHeight / divisor)}`;
}

function formatFriendlyAspectRatio(ratioValue: number): string {
  if (!Number.isFinite(ratioValue) || ratioValue <= 0) {
    return DEFAULT_ASPECT_RATIO;
  }

  const snapped = pickClosestAspectRatio(ratioValue, FRIENDLY_ASPECT_RATIO_CANDIDATES);
  const snappedValue = parseAspectRatioValue(snapped);
  const snapDistance = Math.abs(Math.log(snappedValue / ratioValue));
  if (snapDistance <= Math.log(1.04)) {
    return snapped;
  }

  if (ratioValue >= 1) {
    return `${ratioValue.toFixed(2)}:1`;
  }

  return `1:${(1 / ratioValue).toFixed(2)}`;
}

export function resolveStoryboardRatioControlMode(
  showAdvancedRatioControls: boolean,
  storedMode: StoryboardRatioControlMode | null | undefined
): StoryboardRatioControlMode {
  if (!showAdvancedRatioControls) {
    return 'overall';
  }

  return storedMode === 'overall' ? 'overall' : 'cell';
}

export function resolveStoryboardAspectRatios(
  mode: StoryboardRatioControlMode,
  controlRatioValue: number,
  rows: number,
  cols: number
): {
  cellRatioValue: number;
  overallRatioValue: number;
  cellAspectRatio: string;
  overallAspectRatio: string;
  cellAspectRatioLabel: string;
  overallAspectRatioLabel: string;
} {
  const safeRows = Math.max(1, rows);
  const safeCols = Math.max(1, cols);
  const safeControl = Number.isFinite(controlRatioValue) && controlRatioValue > 0
    ? controlRatioValue
    : 1;

  const cellRatioValue = mode === 'cell'
    ? safeControl
    : safeControl * (safeRows / safeCols);
  const overallRatioValue = mode === 'overall'
    ? safeControl
    : safeControl * (safeCols / safeRows);

  return {
    cellRatioValue,
    overallRatioValue,
    cellAspectRatio: ratioValueToAspectRatioString(cellRatioValue),
    overallAspectRatio: ratioValueToAspectRatioString(overallRatioValue),
    cellAspectRatioLabel: formatFriendlyAspectRatio(cellRatioValue),
    overallAspectRatioLabel: formatFriendlyAspectRatio(overallRatioValue),
  };
}
