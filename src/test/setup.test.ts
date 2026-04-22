import { describe, expect, it } from 'vitest';

describe('test setup', () => {
  it('loads jest-dom matchers', () => {
    const element = document.createElement('div');
    expect(element).not.toBeInTheDocument();
  });
});
