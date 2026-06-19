import { useEffect, useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { UiButton, UiCheckbox, UiInput, UiModal } from '@/components/ui';
import {
  createVideoProviderDraft,
  createVideoProviderModelDraft,
  type VideoProviderConfig,
} from '@/stores/videoProviderConfig';

interface VideoProviderEditorDialogProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialProvider: VideoProviderConfig | null;
  onClose: () => void;
  onSave: (provider: VideoProviderConfig) => void;
}

const VIDEO_PROVIDER_PROTOCOLS = [
  { value: 'agnes-video', label: 'Agnes Video' },
] as const;

const DEFAULT_BASE_URL_MAP: Record<string, string> = {
  'agnes-video': 'https://apihub.agnes-ai.com',
};

function cloneProvider(provider: VideoProviderConfig): VideoProviderConfig {
  return {
    ...provider,
    models: provider.models.map((model) => ({ ...model })),
  };
}

export function VideoProviderEditorDialog({
  isOpen,
  mode,
  initialProvider,
  onClose,
  onSave,
}: VideoProviderEditorDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<VideoProviderConfig>(() =>
    initialProvider ? cloneProvider(initialProvider) : createVideoProviderDraft()
  );
  const [revealedApiKeys, setRevealedApiKeys] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(initialProvider ? cloneProvider(initialProvider) : createVideoProviderDraft());
      setRevealedApiKeys(false);
    }
  }, [isOpen, initialProvider]);

  const updateField = <K extends keyof VideoProviderConfig>(
    key: K,
    value: VideoProviderConfig[K]
  ) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === 'protocol' && typeof value === 'string') {
        next.baseUrl = DEFAULT_BASE_URL_MAP[value] ?? current.baseUrl;
      }
      return next;
    });
  };

  const addModel = () => {
    setDraft((current) => ({
      ...current,
      models: [...current.models, createVideoProviderModelDraft()],
    }));
  };

  const removeModel = (modelId: string) => {
    setDraft((current) => ({
      ...current,
      models: current.models.filter((model) => model.id !== modelId),
    }));
  };

  const updateModel = (
    modelId: string,
    patch: Partial<{ displayName: string; remoteModelId: string; enabled: boolean }>
  ) => {
    setDraft((current) => ({
      ...current,
      models: current.models.map((model) =>
        model.id === modelId ? { ...model, ...patch } : model
      ),
    }));
  };

  const canSave = draft.name.trim() && draft.baseUrl.trim() && draft.apiKey.trim() && draft.models.some((m) => m.enabled && m.remoteModelId.trim());

  return (
    <UiModal
      isOpen={isOpen}
      title={mode === 'create' ? t('settings.videoProvidersAdd') : t('settings.videoProvidersEdit')}
      onClose={onClose}
      widthClassName="max-w-lg"
    >
      <div className="flex flex-col gap-4 p-6">

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-text-muted">{t('settings.customProviderName')}</span>
            <UiInput
              value={draft.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder={t('settings.customProviderNamePlaceholder')}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-text-muted">{t('settings.customProviderProtocol')}</span>
            <select
              value={draft.protocol}
              onChange={(event) => updateField('protocol', event.target.value as VideoProviderConfig['protocol'])}
              className="w-full rounded border border-border-dark bg-bg-dark px-3 py-2 text-sm text-text-dark"
            >
              {VIDEO_PROVIDER_PROTOCOLS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text-dark">{t('settings.customProviderConnectionSection')}</h3>
          <p className="text-xs text-text-muted">{t('settings.videoProviderConnectionDesc')}</p>

          <label className="block">
            <span className="mb-1 block text-xs text-text-muted">{t('settings.customProviderBaseUrl')}</span>
            <UiInput
              value={draft.baseUrl}
              onChange={(event) => updateField('baseUrl', event.target.value)}
              placeholder={t('settings.videoProviderBaseUrlPlaceholder')}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-text-muted">{t('settings.customProviderApiKey')}</span>
            <div className="relative">
              <UiInput
                type={revealedApiKeys ? 'text' : 'password'}
                value={draft.apiKey}
                onChange={(event) => updateField('apiKey', event.target.value)}
                placeholder={t('settings.customProviderApiKeyPlaceholder') ?? '••••••••'}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-dark"
                onClick={() => setRevealedApiKeys((prev) => !prev)}
              >
                {revealedApiKeys ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-dark">{t('settings.customProviderModels')}</h3>
            <UiButton type="button" size="sm" variant="ghost" className="gap-1" onClick={addModel}>
              <Plus size={14} />
              {t('common.add')}
            </UiButton>
          </div>
          <p className="text-xs text-text-muted">{t('settings.customProviderModelsDesc')}</p>

          <div className="space-y-2">
            {draft.models.map((model) => (
              <div key={model.id} className="space-y-2 rounded-lg border border-border-dark bg-bg-dark/60 p-3">
                <div className="flex items-center gap-2">
                  <UiInput
                    value={model.displayName}
                    onChange={(event) => updateModel(model.id, { displayName: event.target.value })}
                    placeholder={t('settings.customProviderModelNamePlaceholder')}
                    className="flex-1"
                  />
                  <UiButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeModel(model.id)}
                    disabled={draft.models.length <= 1}
                  >
                    <Trash2 size={14} />
                  </UiButton>
                </div>
                <UiInput
                  value={model.remoteModelId}
                  onChange={(event) => updateModel(model.id, { remoteModelId: event.target.value })}
                  placeholder={t('settings.customProviderModelIdPlaceholder')}
                />
                <label className="flex items-center gap-3 rounded-lg border border-border-dark bg-bg-dark/60 px-3 py-2">
                  <UiCheckbox
                    checked={model.enabled}
                    onCheckedChange={(checked) => updateModel(model.id, { enabled: checked })}
                  />
                  <span className="text-xs text-text-dark">{t('settings.customProviderModelEnabled')}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border-dark pt-4">
          <UiButton type="button" variant="muted" onClick={onClose}>
            {t('common.cancel')}
          </UiButton>
          <UiButton type="button" variant="primary" disabled={!canSave} onClick={() => onSave(draft)}>
            {t('common.save')}
          </UiButton>
        </div>
      </div>
    </UiModal>
  );
}
