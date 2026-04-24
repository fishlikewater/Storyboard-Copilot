import { describe, expect, it } from 'vitest';

import { appendPromptTemplateContent } from './promptTemplateText';

describe('appendPromptTemplateContent', () => {
  it('returns template content when current prompt is empty', () => {
    expect(appendPromptTemplateContent('', 'cinematic portrait')).toBe('cinematic portrait');
  });

  it('adds a blank line before appending to a non-empty prompt', () => {
    expect(appendPromptTemplateContent('原有描述', 'cinematic portrait')).toBe(
      '原有描述\n\ncinematic portrait'
    );
  });
});
