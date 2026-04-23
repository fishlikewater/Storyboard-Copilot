import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { UiButton, UiCheckbox, UiInput, UiModal, UiSelect } from '@/components/ui';
import {
  createCustomProviderDraft,
  createCustomProviderModelDraft,
  validateCustomProviders,
  type CustomProviderConfig,
} from '@/stores/customProviderConfig';

interface CustomProviderEditorDialogProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialProvider: CustomProviderConfig | null;
  onClose: () => void;
  onSave: (provider: CustomProviderConfig) => void;
}

function cloneProvider(provider: CustomProviderConfig): CustomProviderConfig {
  return {
    ...provider,
    models: provider.models.map((model) => ({ ...model })),
  };
}

function hasFieldError(errors: string[], fieldPath: string): boolean {
  return errors.includes(fieldPath);
}

function buildDialogValidationErrors(draft: CustomProviderConfig): string[] {
  const errors = validateCustomProviders([draft]);

  draft.models.forEach((model, modelIndex) => {
    if (!model.displayName.trim()) {
      errors.push(`provider[0].models[${modelIndex}].displayName`);
    }
    if (!model.remoteModelId.trim()) {
      errors.push(`provider[0].models[${modelIndex}].remoteModelId`);
    }
  });

  return errors;
}

export function CustomProviderEditorDialog({
  isOpen,
  mode,
  initialProvider,
  onClose,
  onSave,
}: CustomProviderEditorDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CustomProviderConfig>(createCustomProviderDraft());
  const [revealedApiKey, setRevealedApiKey] = useState(false);
  const validationErrors = useMemo(() => buildDialogValidationErrors(draft), [draft]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraft(initialProvider ? cloneProvider(initialProvider) : createCustomProviderDraft());
    setRevealedApiKey(false);
  }, [initialProvider, isOpen]);

  const handleSave = () => {
    if (validationErrors.length > 0) {
      return;
    }

    onSave(draft);
  };

  return (
    <UiModal
      isOpen={isOpen}
      title={mode === 'create' ? t('settings.addSupplier') : t('settings.editSupplier')}
      onClose={onClose}
      widthClassName="w-[720px]"
      footer={(
        <>
          <UiButton variant="muted" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </UiButton>
          <UiButton variant="primary" size="sm" onClick={handleSave}>
            {t('common.save')}
          </UiButton>
        </>
      )}
    >
      <div className="space-y-4">
        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {t('settings.customProviderValidationHint')}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-text-dark">
              {t('settings.customProviderName')}
            </span>
            <UiInput
              aria-label={t('settings.customProviderName')}
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className={hasFieldError(validationErrors, 'provider[0].name') ? 'border-red-400/60' : ''}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-text-dark">
              {t('settings.customProviderProtocol')}
            </span>
            <UiSelect
              aria-label={t('settings.customProviderProtocol')}
              value={draft.protocol}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  protocol: event.target.value as CustomProviderConfig['protocol'],
                }))
              }
              className="h-10 text-sm"
            >
              <option value="openapi">{t('settings.customProviderProtocolOpenapi')}</option>
            </UiSelect>
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-xs font-medium text-text-dark">
            {t('settings.customProviderBaseUrl')}
          </span>
          <UiInput
            aria-label={t('settings.customProviderBaseUrl')}
            value={draft.baseUrl}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                baseUrl: event.target.value,
              }))
            }
            className={hasFieldError(validationErrors, 'provider[0].baseUrl') ? 'border-red-400/60' : ''}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-text-dark">
            {t('settings.customProviderApiKey')}
          </span>
          <div className="relative">
            <UiInput
              aria-label={t('settings.customProviderApiKey')}
              type={revealedApiKey ? 'text' : 'password'}
              value={draft.apiKey}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  apiKey: event.target.value,
                }))
              }
              className={`pr-10 ${hasFieldError(validationErrors, 'provider[0].apiKey') ? 'border-red-400/60' : ''}`}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted transition-colors hover:bg-bg-dark"
              onClick={() => setRevealedApiKey((current) => !current)}
            >
              {revealedApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <div className="space-y-3 rounded-lg border border-border-dark bg-bg-dark/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-text-dark">
                {t('settings.customProviderModels')}
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                {t('settings.customProviderModelsDesc')}
              </div>
            </div>
            <UiButton
              type="button"
              size="sm"
              variant="ghost"
              className="gap-2"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  models: [...current.models, createCustomProviderModelDraft()],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              {t('settings.addCustomProviderModel')}
            </UiButton>
          </div>

          {hasFieldError(validationErrors, 'provider[0].models') && (
            <div className="text-[11px] text-amber-200">
              {t('settings.customProviderModelsValidation')}
            </div>
          )}

          {draft.models.map((model, modelIndex) => (
            <div
              key={model.id}
              className="space-y-3 rounded-lg border border-border-dark bg-surface-dark p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium text-text-dark">
                  {model.displayName || t('settings.customProviderModelUntitled')}
                </div>
                <UiButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-2 text-text-muted"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      models: current.models.filter((item) => item.id !== model.id),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete')}
                </UiButton>
              </div>

              <label className="space-y-1">
                <span className="text-xs font-medium text-text-dark">
                  {t('settings.customProviderModelName')}
                </span>
                <UiInput
                  aria-label={t('settings.customProviderModelName')}
                  value={model.displayName}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      models: current.models.map((item) =>
                        item.id === model.id ? { ...item, displayName: event.target.value } : item
                      ),
                    }))
                  }
                  className={
                    hasFieldError(validationErrors, `provider[0].models[${modelIndex}].displayName`)
                      ? 'border-red-400/60'
                      : ''
                  }
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-text-dark">
                  {t('settings.customProviderModelId')}
                </span>
                <UiInput
                  aria-label={t('settings.customProviderModelId')}
                  value={model.remoteModelId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      models: current.models.map((item) =>
                        item.id === model.id ? { ...item, remoteModelId: event.target.value } : item
                      ),
                    }))
                  }
                  className={
                    hasFieldError(validationErrors, `provider[0].models[${modelIndex}].remoteModelId`)
                      ? 'border-red-400/60'
                      : ''
                  }
                />
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-border-dark bg-bg-dark/60 px-3 py-2">
                <UiCheckbox
                  checked={model.enabled}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      models: current.models.map((item) =>
                        item.id === model.id ? { ...item, enabled: checked } : item
                      ),
                    }))
                  }
                />
                <span className="text-xs text-text-dark">
                  {t('settings.customProviderModelEnabled')}
                </span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </UiModal>
  );
}
