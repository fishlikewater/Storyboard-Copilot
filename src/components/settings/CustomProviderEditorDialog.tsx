import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { UiButton, UiCheckbox, UiInput, UiModal, UiSelect } from '@/components/ui';
import {
  createCustomProviderDraft,
  createCustomProviderModelDraft,
  validateCustomProviders,
  type CustomProviderConnectionConfig,
  type CustomProviderConfig,
  type OpenApiConnectionConfig,
  type XaisTaskConnectionConfig,
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
    connection: provider.connection
      ? {
          openapi: provider.connection.openapi
            ? { ...provider.connection.openapi }
            : undefined,
          xaisTask: provider.connection.xaisTask
            ? { ...provider.connection.xaisTask }
            : undefined,
        }
      : undefined,
    models: provider.models.map((model) => ({ ...model })),
  };
}

function syncOpenApiConnection(
  draft: CustomProviderConfig,
  patch: Partial<Pick<CustomProviderConfig, 'baseUrl' | 'apiKey'>>
): CustomProviderConfig {
  const nextBaseUrl = patch.baseUrl ?? draft.baseUrl;
  const nextApiKey = patch.apiKey ?? draft.apiKey;

  return {
    ...draft,
    ...patch,
    connection: {
      ...draft.connection,
      openapi: {
        baseUrl: nextBaseUrl,
        apiKey: nextApiKey,
      },
    },
  };
}

const EMPTY_XAIS_TASK_CONNECTION: XaisTaskConnectionConfig = {
  submitBaseUrl: '',
  waitBaseUrl: '',
  assetBaseUrl: '',
  apiKey: '',
  defaultOutputFormat: 'image/png',
};

function resolveDraftOpenApiConnection(
  draft: CustomProviderConfig
): OpenApiConnectionConfig {
  return draft.connection?.openapi ?? {
    baseUrl: draft.baseUrl,
    apiKey: draft.apiKey,
  };
}

function resolveDraftXaisTaskConnection(
  draft: CustomProviderConfig
): XaisTaskConnectionConfig {
  return {
    ...EMPTY_XAIS_TASK_CONNECTION,
    ...draft.connection?.xaisTask,
  };
}

function ensureProtocolConnection(
  draft: CustomProviderConfig,
  protocol: CustomProviderConfig['protocol']
): CustomProviderConfig {
  if (protocol === 'xais-task') {
    return {
      ...draft,
      protocol,
      connection: {
        ...draft.connection,
        xaisTask: resolveDraftXaisTaskConnection(draft),
      } satisfies CustomProviderConnectionConfig,
    };
  }

  const openapi = resolveDraftOpenApiConnection(draft);
  return {
    ...draft,
    protocol,
    baseUrl: openapi.baseUrl,
    apiKey: openapi.apiKey,
    connection: {
      ...draft.connection,
      openapi,
    } satisfies CustomProviderConnectionConfig,
  };
}

function syncXaisTaskConnection(
  draft: CustomProviderConfig,
  patch: Partial<XaisTaskConnectionConfig>
): CustomProviderConfig {
  return {
    ...draft,
    connection: {
      ...draft.connection,
      xaisTask: {
        ...resolveDraftXaisTaskConnection(draft),
        ...patch,
      },
    },
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
  const openApiConnection = useMemo(() => resolveDraftOpenApiConnection(draft), [draft]);
  const xaisTaskConnection = useMemo(() => resolveDraftXaisTaskConnection(draft), [draft]);

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
      widthClassName="h-[500px] w-[700px] max-w-[96vw]"
      bodyClassName="min-h-0"
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
      <div className="flex h-full min-h-0 flex-col gap-4">
        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {t('settings.customProviderValidationHint')}
          </div>
        )}

        <div
          data-testid="custom-provider-editor-scroll-area"
          className="ui-scrollbar min-h-0 flex-1 overflow-y-auto pr-1"
        >
          <div className="space-y-4">
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
                    setDraft((current) =>
                      ensureProtocolConnection(
                        current,
                        event.target.value as CustomProviderConfig['protocol']
                      )
                    )
                  }
                  className="h-10 text-sm"
                >
                  <option value="openapi">{t('settings.customProviderProtocolOpenapi')}</option>
                  <option value="xais-task">{t('settings.customProviderProtocolXaisTask')}</option>
                </UiSelect>
              </label>
            </div>

            <div className="space-y-3 rounded-lg border border-border-dark bg-bg-dark/60 p-3">
              <div>
                <div className="text-xs font-medium text-text-dark">
                  {t('settings.customProviderConnectionSection')}
                </div>
                <div className="mt-1 text-[11px] text-text-muted">
                  {draft.protocol === 'xais-task'
                    ? t('settings.customProviderConnectionXaisTaskDesc')
                    : t('settings.customProviderConnectionOpenapiDesc')}
                </div>
              </div>

              {draft.protocol === 'xais-task' ? (
                <>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-text-dark">
                      {t('settings.customProviderXaisSubmitBaseUrl')}
                    </span>
                    <UiInput
                      aria-label={t('settings.customProviderXaisSubmitBaseUrl')}
                      value={xaisTaskConnection.submitBaseUrl}
                      onChange={(event) =>
                        setDraft((current) =>
                          syncXaisTaskConnection(current, {
                            submitBaseUrl: event.target.value,
                          })
                        )
                      }
                      className={
                        hasFieldError(validationErrors, 'provider[0].connection.xaisTask.submitBaseUrl')
                          ? 'border-red-400/60'
                          : ''
                      }
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-text-dark">
                        {t('settings.customProviderXaisWaitBaseUrl')}
                      </span>
                      <UiInput
                        aria-label={t('settings.customProviderXaisWaitBaseUrl')}
                        value={xaisTaskConnection.waitBaseUrl}
                        onChange={(event) =>
                          setDraft((current) =>
                            syncXaisTaskConnection(current, {
                              waitBaseUrl: event.target.value,
                            })
                          )
                        }
                        className={
                          hasFieldError(validationErrors, 'provider[0].connection.xaisTask.waitBaseUrl')
                            ? 'border-red-400/60'
                            : ''
                        }
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-medium text-text-dark">
                        {t('settings.customProviderXaisAssetBaseUrl')}
                      </span>
                      <UiInput
                        aria-label={t('settings.customProviderXaisAssetBaseUrl')}
                        value={xaisTaskConnection.assetBaseUrl}
                        onChange={(event) =>
                          setDraft((current) =>
                            syncXaisTaskConnection(current, {
                              assetBaseUrl: event.target.value,
                            })
                          )
                        }
                        className={
                          hasFieldError(validationErrors, 'provider[0].connection.xaisTask.assetBaseUrl')
                            ? 'border-red-400/60'
                            : ''
                        }
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-text-dark">
                        {t('settings.customProviderApiKey')}
                      </span>
                      <div className="relative">
                        <UiInput
                          aria-label={t('settings.customProviderApiKey')}
                          type={revealedApiKey ? 'text' : 'password'}
                          value={xaisTaskConnection.apiKey}
                          onChange={(event) =>
                            setDraft((current) =>
                              syncXaisTaskConnection(current, {
                                apiKey: event.target.value,
                              })
                            )
                          }
                          className={`pr-10 ${
                            hasFieldError(validationErrors, 'provider[0].connection.xaisTask.apiKey')
                              ? 'border-red-400/60'
                              : ''
                          }`}
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

                    <label className="space-y-1">
                      <span className="text-xs font-medium text-text-dark">
                        {t('settings.customProviderDefaultOutputFormat')}
                      </span>
                      <UiSelect
                        aria-label={t('settings.customProviderDefaultOutputFormat')}
                        value={xaisTaskConnection.defaultOutputFormat ?? 'image/png'}
                        onChange={(event) =>
                          setDraft((current) =>
                            syncXaisTaskConnection(current, {
                              defaultOutputFormat: event.target.value as XaisTaskConnectionConfig['defaultOutputFormat'],
                            })
                          )
                        }
                        className="h-10 text-sm"
                      >
                        <option value="image/png">{t('settings.customProviderOutputFormatPng')}</option>
                        <option value="image/jpeg">{t('settings.customProviderOutputFormatJpeg')}</option>
                      </UiSelect>
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-text-dark">
                      {t('settings.customProviderBaseUrl')}
                    </span>
                    <UiInput
                      aria-label={t('settings.customProviderBaseUrl')}
                      value={openApiConnection.baseUrl}
                      onChange={(event) =>
                        setDraft((current) =>
                          syncOpenApiConnection(current, {
                            baseUrl: event.target.value,
                          })
                        )
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
                        value={openApiConnection.apiKey}
                        onChange={(event) =>
                          setDraft((current) =>
                            syncOpenApiConnection(current, {
                              apiKey: event.target.value,
                            })
                          )
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
                </>
              )}
            </div>

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

              <div
                data-testid="custom-provider-model-list"
                className="ui-scrollbar min-h-0 max-h-64 space-y-3 overflow-y-auto pr-1"
              >
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
          </div>
        </div>
      </div>
    </UiModal>
  );
}
