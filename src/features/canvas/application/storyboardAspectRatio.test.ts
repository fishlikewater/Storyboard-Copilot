import { describe, expect, it } from 'vitest';

import {
  resolveStoryboardAspectRatios,
  resolveStoryboardRatioControlMode,
} from './storyboardAspectRatio';

describe('storyboardAspectRatio', () => {
  it('defaults hidden advanced controls to overall mode so request ratio follows the selected ratio', () => {
    const mode = resolveStoryboardRatioControlMode(false, 'cell');
    const ratios = resolveStoryboardAspectRatios(mode, 16 / 9, 2, 1);

    expect(mode).toBe('overall');
    expect(ratios.overallRatioValue).toBeCloseTo(16 / 9, 6);
    expect(ratios.overallAspectRatioLabel).toBe('16:9');
    expect(ratios.cellRatioValue).toBeCloseTo((16 / 9) * 2, 6);
  });

  it('keeps explicit cell mode when advanced controls are enabled', () => {
    const mode = resolveStoryboardRatioControlMode(true, 'cell');
    const ratios = resolveStoryboardAspectRatios(mode, 16 / 9, 2, 1);

    expect(mode).toBe('cell');
    expect(ratios.cellRatioValue).toBeCloseTo(16 / 9, 6);
    expect(ratios.cellAspectRatioLabel).toBe('16:9');
    expect(ratios.overallRatioValue).toBeCloseTo(8 / 9, 6);
  });
});
