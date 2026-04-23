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
  name: '公司网关',
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
};

describe('CustomProviderEditorDialog', () => {
  it('blocks invalid drafts and saves valid create drafts', async () => {
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

    await user.type(screen.getByLabelText('settings.customProviderName'), '公司网关');
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
      name: '公司网关',
      baseUrl: 'https://sg2c.dchai.cn/v1',
      apiKey: 'token-1',
    });
  });

  it('prefills edit mode and saves the updated supplier', async () => {
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

    const nameInput = screen.getByLabelText('settings.customProviderName');
    expect(nameInput).toHaveValue('公司网关');

    await user.clear(nameInput);
    await user.type(nameInput, '新公司网关');
    await user.click(screen.getByRole('button', { name: 'common.save' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'gateway-a',
        name: '新公司网关',
      })
    );
  });
});
