import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSettingsStore } from '@/stores/settingsStore';

import { SettingsDialog } from './SettingsDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      key === 'settings.deleteSupplierConfirm'
        ? `settings.deleteSupplierConfirm:${params?.name ?? ''}`
        : key,
    i18n: { language: 'zh-CN' },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

vi.mock('@/components/ui/useDialogTransition', () => ({
  useDialogTransition: (isOpen: boolean) => ({
    shouldRender: isOpen,
    isVisible: isOpen,
  }),
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('0.0.0-test'),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

vi.mock('@/features/canvas/models', () => ({
  listModelProviders: vi.fn(() => [
    { id: 'kie', name: 'Kie', label: '可灵' },
    { id: 'grsai', name: 'GRSAI', label: 'GRSAI' },
  ]),
}));

vi.mock('@/components/settings/BuiltinProviderSettingsSection', () => ({
  BuiltinProviderSettingsSection: () => (
    <div data-testid="builtin-provider-settings">builtin-provider-settings</div>
  ),
}));

describe('SettingsDialog', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      hideProviderGuidePopover: true,
      customProviders: [],
      apiKeys: {},
    });
  });

  it('renders providers and suppliers categories, and switches content area', async () => {
    const user = userEvent.setup();

    render(<SettingsDialog isOpen onClose={vi.fn()} initialCategory="providers" />);

    expect(screen.getByRole('button', { name: 'settings.providers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.suppliers' })).toBeInTheDocument();
    expect(screen.getByTestId('builtin-provider-settings')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'settings.suppliers' }));

    expect(await screen.findByRole('button', { name: 'settings.addSupplier' })).toBeInTheDocument();
  });

  it('keeps builtin provider save available even when custom provider drafts are invalid', async () => {
    useSettingsStore.setState({
      hideProviderGuidePopover: true,
      apiKeys: {},
      customProviders: [
        {
          id: 'draft-provider',
          name: '',
          protocol: 'openapi',
          baseUrl: '',
          apiKey: '',
          models: [],
        },
      ],
    });

    render(<SettingsDialog isOpen onClose={vi.fn()} initialCategory="providers" />);

    expect(await screen.findByRole('button', { name: 'common.save' })).toBeEnabled();
  });

  it('adds a supplier from the suppliers page and refreshes the list immediately', async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({
      hideProviderGuidePopover: true,
      apiKeys: {},
      customProviders: [],
    });

    render(<SettingsDialog isOpen onClose={vi.fn()} initialCategory="suppliers" />);

    await user.click(screen.getByRole('button', { name: 'settings.addSupplier' }));
    await user.type(screen.getByLabelText('settings.customProviderName'), 'Acme Gateway');
    await user.type(
      screen.getByLabelText('settings.customProviderBaseUrl'),
      'https://sg2c.dchai.cn/v1'
    );
    await user.type(screen.getByLabelText('settings.customProviderApiKey'), 'token-1');
    await user.type(screen.getByLabelText('settings.customProviderModelName'), 'Nano Banana Pro 2K');
    await user.type(
      screen.getByLabelText('settings.customProviderModelId'),
      'Nano_Banana_Pro_2K_0'
    );
    await user.click(screen.getByRole('button', { name: 'common.save' }));

    expect(await screen.findByText('Acme Gateway')).toBeInTheDocument();
    expect(screen.getByText('Nano Banana Pro 2K')).toBeInTheDocument();
  });

  it('edits an existing supplier from the suppliers page and refreshes the summary immediately', async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({
      hideProviderGuidePopover: true,
      apiKeys: {},
      customProviders: [
        {
          id: 'gateway-a',
          name: 'Acme Gateway',
          protocol: 'openapi',
          baseUrl: 'https://sg2c.dchai.cn/v1',
          apiKey: 'token-1',
          models: [
            {
              id: 'model-main',
              displayName: 'Nano Banana Pro 2K',
              remoteModelId: 'Nano_Banana_Pro_2K_0',
              enabled: true,
            },
          ],
        },
      ],
    });

    render(<SettingsDialog isOpen onClose={vi.fn()} initialCategory="suppliers" />);

    await user.click(screen.getByRole('button', { name: 'common.edit' }));
    const nameInput = screen.getByLabelText('settings.customProviderName');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Gateway');
    await user.click(screen.getByRole('button', { name: 'common.save' }));

    expect(await screen.findByText('Renamed Gateway')).toBeInTheDocument();
    expect(screen.queryByText('Acme Gateway')).not.toBeInTheDocument();
  });

  it('deletes an existing supplier only after confirmation and refreshes the list', async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({
      hideProviderGuidePopover: true,
      apiKeys: {},
      customProviders: [
        {
          id: 'gateway-a',
          name: 'Acme Gateway',
          protocol: 'openapi',
          baseUrl: 'https://sg2c.dchai.cn/v1',
          apiKey: 'token-1',
          models: [
            {
              id: 'model-main',
              displayName: 'Nano Banana Pro 2K',
              remoteModelId: 'Nano_Banana_Pro_2K_0',
              enabled: true,
            },
          ],
        },
      ],
    });

    render(<SettingsDialog isOpen onClose={vi.fn()} initialCategory="suppliers" />);

    expect(screen.getByText('Acme Gateway')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'common.delete' }));
    expect(
      screen.getByText('settings.deleteSupplierConfirm:Acme Gateway')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'settings.confirmDeleteSupplier' }));

    expect(screen.queryByText('Acme Gateway')).not.toBeInTheDocument();
    expect(screen.getByText('settings.customProvidersEmpty')).toBeInTheDocument();
  });
});
