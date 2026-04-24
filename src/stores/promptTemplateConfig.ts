export interface PromptTemplateConfig {
  id: string;
  title: string;
  content: string;
}

export interface PromptTemplateDraftErrors {
  title?: 'required' | 'duplicate';
  content?: 'required';
}

function trim(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function normalizePromptTemplateId(value: string | null | undefined): string {
  return trim(value)
    .toLowerCase()
    .replace(/\s+/gu, '-')
    .replace(/[^a-z0-9_-]+/gu, '')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function createDraftId(): string {
  return `prompt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizePromptTemplateTitle(value: string | null | undefined): string {
  return trim(value).replace(/\s+/gu, ' ');
}

export function createPromptTemplateDraft(): PromptTemplateConfig {
  return {
    id: createDraftId(),
    title: '',
    content: '',
  };
}

export function normalizePromptTemplates(
  input: PromptTemplateConfig[] | null | undefined
): PromptTemplateConfig[] {
  const seenTitles = new Set<string>();

  return (input ?? [])
    .map((template) => ({
      id: normalizePromptTemplateId(template.id) || createDraftId(),
      title: normalizePromptTemplateTitle(template.title),
      content: trim(template.content),
    }))
    .filter((template) => template.title && template.content)
    .filter((template) => {
      if (seenTitles.has(template.title)) {
        return false;
      }
      seenTitles.add(template.title);
      return true;
    });
}

export function validatePromptTemplateDraft(
  draft: PromptTemplateConfig,
  existingTemplates: PromptTemplateConfig[],
  options?: { excludeId?: string }
): PromptTemplateDraftErrors {
  const title = normalizePromptTemplateTitle(draft.title);
  const content = trim(draft.content);
  const nextErrors: PromptTemplateDraftErrors = {};

  if (!title) {
    nextErrors.title = 'required';
  } else {
    const duplicated = existingTemplates.some(
      (template) =>
        template.id !== options?.excludeId &&
        normalizePromptTemplateTitle(template.title) === title
    );
    if (duplicated) {
      nextErrors.title = 'duplicate';
    }
  }

  if (!content) {
    nextErrors.content = 'required';
  }

  return nextErrors;
}
