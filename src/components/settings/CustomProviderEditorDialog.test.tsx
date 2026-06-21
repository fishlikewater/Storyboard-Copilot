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
  protocol: 'openapi', mediaType: 'image',
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
      protocol: 'openapi', mediaType: 'image',
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

  it('offers only the supported supplier protocols', async () => {
    const user = userEvent.setup();

    render(
      <CustomProviderEditorDialog
        isOpen
        mode="create"
        initialProvider={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'settings.customProviderProtocol' }));

    expect(screen.getByRole('option', { name: 'settings.customProviderProtocolOpenapi' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'settings.customProviderProtocolOpenaiImage' })).toBeInTheDocument();
  });

  it('switches to openai-image fields and saves openapi-style connection data', async () => {
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

    await user.click(screen.getByRole('button', { name: 'settings.customProviderProtocol' }));
    await user.click(
      screen.getByRole('option', { name: 'settings.customProviderProtocolOpenaiImage' })
    );

    expect(screen.getByLabelText('settings.customProviderBaseUrl')).toBeInTheDocument();

    await user.type(screen.getByLabelText('settings.customProviderName'), 'OpenAI Images');
    await user.type(
      screen.getByLabelText('settings.customProviderBaseUrl'),
      'https://api.openai.com/v1'
    );
    await user.type(screen.getByLabelText('settings.customProviderApiKey'), 'sk-openai');
    await user.type(screen.getByLabelText('settings.customProviderModelName'), 'GPT Image');
    await user.type(screen.getByLabelText('settings.customProviderModelId'), 'gpt-image-1');
    await user.click(screen.getByRole('button', { name: 'common.save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'OpenAI Images',
      protocol: 'openai-image', mediaType: 'image',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-openai',
      connection: {
        openapi: {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-openai',
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
