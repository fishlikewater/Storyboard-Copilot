import type { Dispatch, SetStateAction } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import type { ModelProviderDefinition } from '@/features/canvas/models';
import { GRSAI_NANO_BANANA_PRO_MODEL_OPTIONS } from '@/features/canvas/models/providers/grsai';
import { UiSelect } from '@/components/ui';

interface BuiltinProviderSettingsSectionProps {
  providers: ModelProviderDefinition[];
  localApiKeys: Record<string, string>;
  setLocalApiKeys: Dispatch<SetStateAction<Record<string, string>>>;
  revealedApiKeys: Record<string, boolean>;
  setRevealedApiKeys: Dispatch<SetStateAction<Record<string, boolean>>>;
  localGrsaiNanoBananaProModel: string;
  setLocalGrsaiNanoBananaProModel: (value: string) => void;
  setProviderApiKey: (providerId: string, key: string) => void;
}

const PROVIDER_REGISTER_URLS: Record<string, string> = {
  ppio: 'https://ppio.com/user/register?invited_by=WGY0DZ',
  grsai: 'https://grsai.com',
  kie: 'https://kie.ai?ref=eef20ef0b0595cad227d45b29c635f6c',
  fal: 'https://fal.ai',
};

const PROVIDER_GET_KEY_URLS: Record<string, string> = {
  ppio: 'https://ppio.com/settings/key-management',
  grsai: 'https://grsai.com/zh/dashboard/api-keys',
  kie: 'https://kie.ai/api-key',
  fal: 'https://fal.ai/dashboard/keys',
};

export function BuiltinProviderSettingsSection({
  providers,
  localApiKeys,
  setLocalApiKeys,
  revealedApiKeys,
  setRevealedApiKeys,
  localGrsaiNanoBananaProModel,
  setLocalGrsaiNanoBananaProModel,
  setProviderApiKey,
}: BuiltinProviderSettingsSectionProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="ui-scrollbar flex-1 space-y-4 overflow-y-auto p-6">
      {providers.map((provider) => {
        const displayName = i18n.language.startsWith('zh') ? provider.label : provider.name;
        const isRevealed = Boolean(revealedApiKeys[provider.id]);

        return (
          <div key={provider.id} className="rounded-lg border border-border-dark bg-bg-dark p-4">
            <div className="mb-3">
              <h3 className="text-sm font-medium text-text-dark">{displayName}</h3>
              {PROVIDER_REGISTER_URLS[provider.id] && PROVIDER_GET_KEY_URLS[provider.id] ? (
                <p className="text-xs text-text-muted">
                  {t('settings.providerApiKeyGuidePrefix')}{' '}
                  <a
                    href={PROVIDER_REGISTER_URLS[provider.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    {t('settings.providerRegisterLink')}
                  </a>
                  {t('settings.providerApiKeyGuideMiddle')}{' '}
                  <a
                    href={PROVIDER_GET_KEY_URLS[provider.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    {t('settings.getApiKeyLink')}
                  </a>
                </p>
              ) : (
                <p className="text-xs text-text-muted">{provider.id}</p>
              )}
            </div>

            <div className="relative">
              <input
                type={isRevealed ? 'text' : 'password'}
                value={localApiKeys[provider.id] ?? ''}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setLocalApiKeys((previous) => ({
                    ...previous,
                    [provider.id]: nextValue,
                  }));
                  setProviderApiKey(provider.id, nextValue);
                }}
                placeholder={t('settings.enterApiKey')}
                className="w-full rounded border border-border-dark bg-surface-dark px-3 py-2 pr-10 text-sm text-text-dark placeholder:text-text-muted"
              />
              <button
                type="button"
                onClick={() =>
                  setRevealedApiKeys((previous) => ({
                    ...previous,
                    [provider.id]: !isRevealed,
                  }))
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-bg-dark"
              >
                {isRevealed ? (
                  <EyeOff className="h-4 w-4 text-text-muted" />
                ) : (
                  <Eye className="h-4 w-4 text-text-muted" />
                )}
              </button>
            </div>

            {provider.id === 'grsai' && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-medium text-text-dark">
                  {t('settings.nanoBananaProModel')}
                </div>
                <p className="mb-2 text-xs text-text-muted">
                  <Trans
                    i18nKey="settings.nanoBananaProModelDesc"
                    components={{
                      modelListLink: (
                        <a
                          href="https://grsai.com/zh/dashboard/models"
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline"
                        />
                      ),
                    }}
                  />
                </p>
                <UiSelect
                  value={localGrsaiNanoBananaProModel}
                  onChange={(event) => setLocalGrsaiNanoBananaProModel(event.target.value)}
                  className="h-9 text-sm"
                >
                  {GRSAI_NANO_BANANA_PRO_MODEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </UiSelect>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
