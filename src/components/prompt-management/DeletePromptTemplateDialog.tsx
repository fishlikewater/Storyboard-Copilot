import { useTranslation } from 'react-i18next';

import { UiButton, UiModal } from '@/components/ui';
import type { PromptTemplateConfig } from '@/stores/promptTemplateConfig';

interface DeletePromptTemplateDialogProps {
  isOpen: boolean;
  template: PromptTemplateConfig | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeletePromptTemplateDialog({
  isOpen,
  template,
  onClose,
  onConfirm,
}: DeletePromptTemplateDialogProps) {
  const { t } = useTranslation();

  return (
    <UiModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('promptTemplates.deleteTitle')}
      widthClassName="w-[420px]"
      footer={(
        <>
          <UiButton type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </UiButton>
          <UiButton type="button" onClick={onConfirm}>
            {t('common.confirm')}
          </UiButton>
        </>
      )}
    >
      <p className="text-sm text-text-muted">
        {t('promptTemplates.deleteDescription', { title: template?.title ?? '' })}
      </p>
    </UiModal>
  );
}
