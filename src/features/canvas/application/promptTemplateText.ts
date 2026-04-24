export function appendPromptTemplateContent(
  currentPrompt: string,
  templateContent: string
): string {
  const normalizedCurrent = currentPrompt.trimEnd();
  const normalizedTemplate = templateContent.trim();

  if (!normalizedCurrent) {
    return normalizedTemplate;
  }

  if (!normalizedTemplate) {
    return normalizedCurrent;
  }

  return `${normalizedCurrent}\n\n${normalizedTemplate}`;
}
