import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CustomProviderConfig } from '@/stores/customProviderConfig';

import { CustomProvidersPage } from './CustomProvidersPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const providers: CustomProviderConfig[] = [
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
      {
        id: 'model-disabled',
        displayName: 'Disabled Model',
        remoteModelId: 'disabled',
        enabled: false,
      },
    ],
  },
];

describe('CustomProvidersPage', () => {
  it('renders empty state and add button when there are no suppliers', () => {
    render(
      <CustomProvidersPage
        providers={[]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'settings.addSupplier' })).toBeInTheDocument();
    expect(screen.getByText('settings.customProvidersEmpty')).toBeInTheDocument();
  });

  it('renders supplier rows and forwards add/edit/delete actions', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <CustomProvidersPage
        providers={providers}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('Acme Gateway')).toBeInTheDocument();
    expect(screen.getByText('Nano Banana Pro 2K')).toBeInTheDocument();
    expect(screen.queryByText('Disabled Model')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'settings.addSupplier' }));
    await user.click(screen.getByRole('button', { name: 'common.edit' }));
    await user.click(screen.getByRole('button', { name: 'common.delete' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith('gateway-a');
    expect(onDelete).toHaveBeenCalledWith('gateway-a');
  });
});
