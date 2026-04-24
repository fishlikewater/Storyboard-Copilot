import { describe, expect, it } from 'vitest';

import {
  createPromptTemplateDraft,
  normalizePromptTemplates,
  validatePromptTemplateDraft,
} from './promptTemplateConfig';

describe('promptTemplateConfig', () => {
  it('creates a reusable blank draft', () => {
    const draft = createPromptTemplateDraft();

    expect(draft.id).toMatch(/^prompt-/);
    expect(draft.title).toBe('');
    expect(draft.content).toBe('');
  });

  it('normalizes title and content whitespace', () => {
    expect(
      normalizePromptTemplates([
        {
          id: ' prompt-a ',
          title: '  写实人像  ',
          content: '  cinematic portrait  ',
        },
      ])
    ).toEqual([
      {
        id: 'prompt-a',
        title: '写实人像',
        content: 'cinematic portrait',
      },
    ]);
  });

  it('rejects duplicated trimmed titles', () => {
    expect(
      validatePromptTemplateDraft(
        {
          id: 'prompt-b',
          title: ' 写实人像 ',
          content: 'new content',
        },
        [
          {
            id: 'prompt-a',
            title: '写实人像',
            content: 'old content',
          },
        ]
      )
    ).toEqual({
      title: 'duplicate',
    });
  });

  it('requires title and content', () => {
    expect(
      validatePromptTemplateDraft(
        {
          id: 'prompt-a',
          title: '   ',
          content: '   ',
        },
        []
      )
    ).toEqual({
      title: 'required',
      content: 'required',
    });
  });
});
