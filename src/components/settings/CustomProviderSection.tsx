import { useMemo, useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { UiButton, UiCheckbox, UiInput, UiSelect } from '@/components/ui';
import {
  createCustomProviderDraft,
  createCustomProviderModelDraft,
  validateCustomProviders,
  type CustomProviderConfig,
} from '@/stores/customProviderConfig';

interface CustomProviderSectionProps {
  providers: CustomProviderConfig[];
  onChange: (providers: CustomProviderConfig[]) => void;
}

function hasFieldError(errors: string[], fieldPath: string): boolean {
  return errors.includes(fieldPath);
}

function syncOpenApiConnection(
  provider: CustomProviderConfig,
  patch: Partial<Pick<CustomProviderConfig, 'baseUrl' | 'apiKey'>>
): CustomProviderConfig {
  const nextBaseUrl = patch.baseUrl ?? provider.baseUrl;
  const nextApiKey = patch.apiKey ?? provider.apiKey;

  return {
    ...provider,
    ...patch,
    connection: {
      ...provider.connection,
      openapi: {
        baseUrl: nextBaseUrl,
        apiKey: nextApiKey,
      },
    },
  };
}

export function CustomProviderSection({
  providers,
  onChange,
}: CustomProviderSectionProps) {
  const { t } = useTranslation();
  const [revealedApiKeys, setRevealedApiKeys] = useState<Record<string, boolean>>({});
  const validationErrors = useMemo(() => validateCustomProviders(providers), [providers]);

  const updateProvider = (
    providerId: string,
    updater: (provider: CustomProviderConfig) => CustomProviderConfig
  ) => {
    onChange(
      providers.map((provider) => (provider.id === providerId ? updater(provider) : provider))
    );
  };

  const removeProvider = (providerId: string) => {
    onChange(providers.filter((provider) => provider.id !== providerId));
  };

  return (
    <div className="space-y-4 rounded-lg border border-border-dark bg-bg-dark p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-dark">
            {t('settings.customProvidersTitle')}
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            {t('settings.customProvidersDesc')}
          </p>
        </div>
        <UiButton
          type="button"
          size="sm"
          variant="ghost"
          className="gap-2"
          onClick={() => onChange([...providers, createCustomProviderDraft()])}
        >
          <Plus className="h-4 w-4" />
          {t('settings.addCustomProvider')}
        </UiButton>
      </div>

      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {t('settings.customProviderValidationHint')}
        </div>
      )}

      {providers.length === 0 && (
        <div className="rounded-lg border border-dashed border-border-dark px-4 py-5 text-sm text-text-muted">
          {t('settings.customProvidersEmpty')}
        </div>
      )}

      {providers.map((provider, providerIndex) => {
        const isApiKeyRevealed = Boolean(revealedApiKeys[provider.id]);
        const providerNameError = hasFieldError(validationErrors, `provider[${providerIndex}].name`);
        const providerBaseUrlError = hasFieldError(
          validationErrors,
          `provider[${providerIndex}].baseUrl`
        );
        const providerApiKeyError = hasFieldError(validationErrors, `provider[${providerIndex}].apiKey`);
        const providerModelsError = hasFieldError(validationErrors, `provider[${providerIndex}].models`);

        return (
          <div
            key={provider.id}
            className="space-y-4 rounded-lg border border-border-dark bg-surface-dark p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-text-dark">
                  {provider.name || t('settings.customProviderUntitled')}
                </div>
                <div className="mt-1 text-xs text-text-muted">{provider.id}</div>
              </div>
              <UiButton
                type="button"
                size="sm"
                variant="ghost"
                className="gap-2 text-text-muted"
                onClick={() => removeProvider(provider.id)}
              >
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </UiButton>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-text-dark">
                  {t('settings.customProviderName')}
                </span>
                <UiInput
                  value={provider.name}
                  onChange={(event) =>
                    updateProvider(provider.id, (current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder={t('settings.customProviderNamePlaceholder')}
                  className={providerNameError ? 'border-red-400/60' : ''}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-text-dark">
                  {t('settings.customProviderProtocol')}
                </span>
                <UiSelect
                  value={provider.protocol}
                  onChange={(event) =>
                    updateProvider(provider.id, (current) => ({
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
                value={provider.baseUrl}
                onChange={(event) =>
                  updateProvider(provider.id, (current) =>
                    syncOpenApiConnection(current, {
                      baseUrl: event.target.value,
                    })
                  )
                }
                placeholder={t('settings.customProviderBaseUrlPlaceholder')}
                className={providerBaseUrlError ? 'border-red-400/60' : ''}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-text-dark">
                {t('settings.customProviderApiKey')}
              </span>
              <div className="relative">
                <UiInput
                  type={isApiKeyRevealed ? 'text' : 'password'}
                  value={provider.apiKey}
                  onChange={(event) =>
                    updateProvider(provider.id, (current) =>
                      syncOpenApiConnection(current, {
                        apiKey: event.target.value,
                      })
                    )
                  }
                  placeholder={t('settings.enterApiKey')}
                  className={`pr-10 ${providerApiKeyError ? 'border-red-400/60' : ''}`}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted transition-colors hover:bg-bg-dark"
                  onClick={() =>
                    setRevealedApiKeys((previous) => ({
                      ...previous,
                      [provider.id]: !isApiKeyRevealed,
                    }))
                  }
                >
                  {isApiKeyRevealed ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
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
                    updateProvider(provider.id, (current) => ({
                      ...current,
                      models: [...current.models, createCustomProviderModelDraft()],
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  {t('settings.addCustomProviderModel')}
                </UiButton>
              </div>

              {providerModelsError && (
                <div className="text-[11px] text-amber-200">
                  {t('settings.customProviderModelsValidation')}
                </div>
              )}

              {provider.models.map((model) => (
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
                        updateProvider(provider.id, (current) => ({
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
                      value={model.displayName}
                      onChange={(event) =>
                        updateProvider(provider.id, (current) => ({
                          ...current,
                          models: current.models.map((item) =>
                            item.id === model.id
                              ? { ...item, displayName: event.target.value }
                              : item
                          ),
                        }))
                      }
                      placeholder={t('settings.customProviderModelNamePlaceholder')}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium text-text-dark">
                      {t('settings.customProviderModelId')}
                    </span>
                    <UiInput
                      value={model.remoteModelId}
                      onChange={(event) =>
                        updateProvider(provider.id, (current) => ({
                          ...current,
                          models: current.models.map((item) =>
                            item.id === model.id
                              ? { ...item, remoteModelId: event.target.value }
                              : item
                          ),
                        }))
                      }
                      placeholder={t('settings.customProviderModelIdPlaceholder')}
                    />
                  </label>

                  <label className="flex items-center gap-3 rounded-lg border border-border-dark bg-bg-dark/60 px-3 py-2">
                    <UiCheckbox
                      checked={model.enabled}
                      onCheckedChange={(checked) =>
                        updateProvider(provider.id, (current) => ({
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
        );
      })}
    </div>
  );
}
