import { useTranslation } from 'react-i18next';

import { UiButton, UiModal } from '@/components/ui';

interface DeleteProviderConfirmDialogProps {
  isOpen: boolean;
  providerName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteProviderConfirmDialog({
  isOpen,
  providerName,
  onClose,
  onConfirm,
}: DeleteProviderConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <UiModal
      isOpen={isOpen}
      title={t('settings.deleteSupplierTitle')}
      onClose={onClose}
      widthClassName="w-[420px]"
      containerClassName="z-[60]"
      footer={(
        <>
          <UiButton variant="muted" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </UiButton>
          <UiButton variant="primary" size="sm" onClick={onConfirm}>
            {t('settings.confirmDeleteSupplier')}
          </UiButton>
        </>
      )}
    >
      <p className="text-sm text-text-muted">
        {t('settings.deleteSupplierConfirm', { name: providerName })}
      </p>
    </UiModal>
  );
}
