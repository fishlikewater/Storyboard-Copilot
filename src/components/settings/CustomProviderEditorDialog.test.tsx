import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CustomProviderConfig } from '@/stores/customProviderConfig';

import { CustomProviderEditorDialog } from './CustomProviderEditorDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ui/useDialogTransition', () => ({
  useDialogTransition: (isOpen: boolean) => ({
    shouldRender: isOpen,
    isVisible: isOpen,
  }),
}));

const existingProvider: CustomProviderConfig = {
  id: 'gateway-a',
  name: 'Company Gateway',
  protocol: 'openapi',
  baseUrl: 'https://sg2c.dchai.cn/v1',
  apiKey: 'token-1',
  connection: {
    openapi: {
      baseUrl: 'https://sg2c.dchai.cn/v1',
      apiKey: 'token-1',
    },
  },
  models: [
    {
      id: 'model-main',
      displayName: 'Nano Banana Pro 2K',
      remoteModelId: 'Nano_Banana_Pro_2K_0',
      enabled: true,
    },
  ],
}

describe('CustomProviderEditorDialog', () => {
  it('blocks invalid drafts and saves valid openapi drafts', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <CustomProviderEditorDialog
        isOpen
        mode="create"
        initialProvider={null}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: 'common.save' }));
    expect(onSave).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('settings.customProviderName'), 'Company Gateway');
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

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'Company Gateway',
      protocol: 'openapi',
      baseUrl: 'https://sg2c.dchai.cn/v1',
      apiKey: 'token-1',
      connection: {
        openapi: {
          baseUrl: 'https://sg2c.dchai.cn/v1',
          apiKey: 'token-1',
        },
      },
    });
  });

  it('switches to xais-task fields and saves protocol-specific connection data', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <CustomProviderEditorDialog
        isOpen
        mode="create"
        initialProvider={null}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(
      screen.getByRole('button', { name: 'settings.customProviderProtocol' })
    );
    await user.click(screen.getByRole('option', { name: 'settings.customProviderProtocolXaisTask' }));

    expect(await screen.findByLabelText('settings.customProviderXaisSubmitBaseUrl')).toBeInTheDocument();
    expect(screen.queryByLabelText('settings.customProviderBaseUrl')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('settings.customProviderName'), 'Async Gateway');
    await user.type(
      screen.getByLabelText('settings.customProviderXaisSubmitBaseUrl'),
      'https://sg2c.dchai.cn'
    );
    await user.type(
      screen.getByLabelText('settings.customProviderXaisWaitBaseUrl'),
      'https://sg2.dchai.cn'
    );
    await user.type(
      screen.getByLabelText('settings.customProviderXaisAssetBaseUrl'),
      'https://svt1.dchai.cn'
    );
    await user.type(screen.getByLabelText('settings.customProviderApiKey'), 'token-async');
    await user.click(
      screen.getByRole('button', { name: 'settings.customProviderDefaultOutputFormat' })
    );
    await user.click(screen.getByRole('option', { name: 'settings.customProviderOutputFormatJpeg' }));
    await user.type(screen.getByLabelText('settings.customProviderModelName'), 'Nano Banana Pro 2K');
    await user.type(
      screen.getByLabelText('settings.customProviderModelId'),
      'Nano_Banana_Pro_2K_0'
    );
    await user.click(screen.getByRole('button', { name: 'common.save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'Async Gateway',
      protocol: 'xais-task',
      connection: {
        xaisTask: {
          submitBaseUrl: 'https://sg2c.dchai.cn',
          waitBaseUrl: 'https://sg2.dchai.cn',
          assetBaseUrl: 'https://svt1.dchai.cn',
          apiKey: 'token-async',
          defaultOutputFormat: 'image/jpeg',
        },
      },
    });
  });

  it('prefills edit mode and exposes fixed scroll containers', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <CustomProviderEditorDialog
        isOpen
        mode="edit"
        initialProvider={existingProvider}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const scrollArea = screen.getByTestId('custom-provider-editor-scroll-area');
    const modelList = screen.getByTestId('custom-provider-model-list');

    expect(scrollArea).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(modelList).toHaveClass('max-h-64', 'overflow-y-auto');

    const nameInput = screen.getByLabelText('settings.customProviderName');
    expect(nameInput).toHaveValue('Company Gateway');

    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Gateway');
    await user.click(screen.getByRole('button', { name: 'common.save' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'gateway-a',
        name: 'Renamed Gateway',
      })
    );
  });
});
