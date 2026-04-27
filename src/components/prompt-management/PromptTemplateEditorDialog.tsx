import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton, UiInput, UiModal, UiTextAreaField } from '@/components/ui';
import {
  type PromptTemplateConfig,
  validatePromptTemplateDraft,
} from '@/stores/promptTemplateConfig';

interface PromptTemplateEditorDialogProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  template: PromptTemplateConfig | null;
  existingTemplates: PromptTemplateConfig[];
  onClose: () => void;
  onSave: (template: PromptTemplateConfig) => void;
}

export function PromptTemplateEditorDialog({
  isOpen,
  mode,
  template,
  existingTemplates,
  onClose,
  onSave,
}: PromptTemplateEditorDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});

  useEffect(() => {
    if (!isOpen || !template) {
      return;
    }

    setTitle(template.title);
    setContent(template.content);
    setErrors({});
  }, [isOpen, template]);

  const handleSave = () => {
    if (!template) {
      return;
    }

    const draft = {
      ...template,
      title: title.trim(),
      content: content.trim(),
    };
    const nextErrors = validatePromptTemplateDraft(draft, existingTemplates, {
      excludeId: template.id,
    });

    if (nextErrors.title || nextErrors.content) {
      setErrors({
        title:
          nextErrors.title === 'duplicate'
            ? t('promptTemplates.duplicateTitle')
            : nextErrors.title === 'required'
              ? t('promptTemplates.titleRequired')
              : undefined,
        content:
          nextErrors.content === 'required'
            ? t('promptTemplates.contentRequired')
            : undefined,
      });
      return;
    }

    onSave(draft);
    onClose();
  };

  return (
    <UiModal
      isOpen={isOpen}
      onClose={onClose}
      title={t(mode === 'edit' ? 'promptTemplates.editTitle' : 'promptTemplates.createTitle')}
      widthClassName="w-[min(92vw,640px)]"
      footer={(
        <>
          <UiButton type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </UiButton>
          <UiButton type="button" variant="primary" onClick={handleSave}>
            {t('common.save')}
          </UiButton>
        </>
      )}
    >
      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-text-dark">
            {t('promptTemplates.editor.titleLabel')}
          </span>
          <UiInput
            aria-label={t('promptTemplates.editor.titleLabel')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('promptTemplates.editor.titlePlaceholder')}
          />
          {errors.title ? <div className="text-xs text-red-400">{errors.title}</div> : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-text-dark">
            {t('promptTemplates.editor.contentLabel')}
          </span>
          <UiTextAreaField
            aria-label={t('promptTemplates.editor.contentLabel')}
            rows={8}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={t('promptTemplates.editor.contentPlaceholder')}
          />
          {errors.content ? <div className="text-xs text-red-400">{errors.content}</div> : null}
        </label>
      </div>
    </UiModal>
  );
}
