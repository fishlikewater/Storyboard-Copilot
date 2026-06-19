import { useTranslation } from 'react-i18next';

import { UiButton } from '@/components/ui';
import type { VideoProviderConfig } from '@/stores/videoProviderConfig';

interface VideoProvidersPageProps {
  providers: VideoProviderConfig[];
  onAdd: () => void;
  onEdit: (providerId: string) => void;
  onDelete: (providerId: string) => void;
}

function buildModelSummary(provider: VideoProviderConfig, emptyLabel: string): string {
  const enabledModels = provider.models.filter((model) => model.enabled);
  if (enabledModels.length === 0) {
    return emptyLabel;
  }
  return enabledModels.map((model) => model.displayName).join(', ');
}

function buildProtocolSummary(protocol: string, t: (key: string) => string): string {
  if (protocol === 'agnes-video') {
    return t('settings.videoProviderProtocolAgnesVideo');
  }
  return protocol;
}

export function VideoProvidersPage({
  providers,
  onAdd,
  onEdit,
  onDelete,
}: VideoProvidersPageProps) {
  const { t } = useTranslation();
  const sortedProviders = [...providers].sort((left, right) => left.name.localeCompare(right.name));

  return (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-border-dark px-6 py-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-text-dark">{t('settings.videoProvidersTitle')}</h2>
          <p className="mt-1 text-sm text-text-muted">{t('settings.videoProvidersDesc')}</p>
        </div>
        <UiButton type="button" variant="primary" size="sm" className="shrink-0" onClick={onAdd}>
          {t('settings.addSupplier')}
        </UiButton>
      </div>

      <div className="ui-scrollbar flex-1 space-y-3 overflow-y-auto p-6">
        {sortedProviders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-dark px-4 py-8 text-sm text-text-muted">
            {t('settings.videoProvidersEmpty')}
          </div>
        ) : (
          sortedProviders.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border-dark bg-bg-dark p-4"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="truncate text-sm font-medium text-text-dark">{provider.name}</div>
                <div className="grid gap-1 text-xs text-text-muted md:grid-cols-2">
                  <div className="min-w-0 truncate">
                    <span>{t('settings.customProviderProtocol')}</span>
                    <span>:</span>{' '}
                    <span className="font-medium text-text-dark/90">
                      {buildProtocolSummary(provider.protocol, t)}
                    </span>
                  </div>
                  <div className="min-w-0 truncate">
                    <span>{t('settings.customProviderAvailableModels')}</span>
                    <span>:</span>{' '}
                    <span className="font-medium text-text-dark/90">
                      {buildModelSummary(provider, t('settings.customProviderNoEnabledModels'))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <UiButton type="button" size="sm" variant="muted" onClick={() => onEdit(provider.id)}>
                  {t('common.edit')}
                </UiButton>
                <UiButton type="button" size="sm" variant="ghost" onClick={() => onDelete(provider.id)}>
                  {t('common.delete')}
                </UiButton>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
