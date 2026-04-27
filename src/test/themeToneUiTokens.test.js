import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

function readCssRule(selector) {
  const ruleStart = indexCss.indexOf(selector);
  expect(ruleStart).toBeGreaterThanOrEqual(0);

  const bodyStart = indexCss.indexOf('{', ruleStart);
  const bodyEnd = indexCss.indexOf('}', bodyStart + 1);
  const ruleBody = bodyStart >= 0 && bodyEnd > bodyStart ? indexCss.slice(bodyStart + 1, bodyEnd) : '';

  expect(ruleBody).toBeTruthy();

  return ruleBody;
}

describe('theme tone UI tokens', () => {
  it('updates light warm tone panel and field tokens', () => {
    const warmRule = readCssRule(":root[data-theme-tone='warm']");

    expect(warmRule).toContain('--ui-surface-panel: rgba(255, 247, 239, 0.96);');
    expect(warmRule).toContain('--ui-surface-field: rgba(251, 244, 237, 0.95);');
    expect(warmRule).toContain('--ui-border-soft: rgba(120, 99, 82, 0.16);');
    expect(warmRule).toContain('--ui-border-strong: rgba(120, 99, 82, 0.28);');
    expect(warmRule).toContain('--ui-shadow-panel: 0 14px 34px rgba(97, 74, 55, 0.16);');
  });

  it('updates dark warm tone panel and field tokens', () => {
    const darkWarmRule = readCssRule(":root.dark[data-theme-tone='warm']");

    expect(darkWarmRule).toContain('--ui-surface-panel: rgb(32, 24, 20);');
    expect(darkWarmRule).toContain('--ui-surface-field: rgba(24, 18, 15, 0.92);');
    expect(darkWarmRule).toContain('--ui-border-soft: rgba(173, 149, 130, 0.2);');
    expect(darkWarmRule).toContain('--ui-border-strong: rgba(173, 149, 130, 0.32);');
    expect(darkWarmRule).toContain('--ui-shadow-panel: 0 14px 34px rgba(0, 0, 0, 0.42);');
  });

  it('updates light cool tone panel and field tokens', () => {
    const coolRule = readCssRule(":root[data-theme-tone='cool']");

    expect(coolRule).toContain('--ui-surface-panel: rgba(248, 251, 255, 0.96);');
    expect(coolRule).toContain('--ui-surface-field: rgba(240, 246, 253, 0.95);');
    expect(coolRule).toContain('--ui-border-soft: rgba(86, 105, 130, 0.14);');
    expect(coolRule).toContain('--ui-border-strong: rgba(86, 105, 130, 0.24);');
    expect(coolRule).toContain('--ui-shadow-panel: 0 14px 34px rgba(45, 82, 125, 0.14);');
  });

  it('updates dark cool tone panel and field tokens', () => {
    const darkCoolRule = readCssRule(":root.dark[data-theme-tone='cool']");

    expect(darkCoolRule).toContain('--ui-surface-panel: rgb(17, 27, 39);');
    expect(darkCoolRule).toContain('--ui-surface-field: rgba(12, 21, 31, 0.92);');
    expect(darkCoolRule).toContain('--ui-border-soft: rgba(140, 163, 194, 0.2);');
    expect(darkCoolRule).toContain('--ui-border-strong: rgba(140, 163, 194, 0.32);');
    expect(darkCoolRule).toContain('--ui-shadow-panel: 0 14px 34px rgba(2, 8, 18, 0.42);');
  });
});
