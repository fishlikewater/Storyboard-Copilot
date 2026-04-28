import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CustomProviderConfig } from '@/stores/customProviderConfig';

import { CustomProvidersPage } from './CustomProvidersPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'settings.addSupplier': 'Add Supplier',
        'settings.customProvidersEmpty': 'No custom providers yet. Use the button above to add one.',
        'settings.customProviderProtocol': 'Access Protocol',
        'settings.customProviderProtocolOpenapi': 'OpenAPI Compatible',
        'settings.customProviderProtocolXaisTask': 'XAIS Task',
        'settings.customProviderAvailableModels': 'Available Models',
        'settings.customProviderNoEnabledModels': 'No enabled models',
        'common.edit': 'Edit',
        'common.delete': 'Delete',
      }[key] ?? key),
  }),
}));

const openApiProvider: CustomProviderConfig = {
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
};

const xaisTaskProvider: CustomProviderConfig = {
  id: 'gateway-b',
  name: 'Async Gateway',
  protocol: 'xais-task',
  baseUrl: '',
  apiKey: '',
  connection: {
    xaisTask: {
      submitBaseUrl: 'https://api.example.com/submit',
      waitBaseUrl: 'https://api.example.com/wait',
      assetBaseUrl: 'https://api.example.com/assets',
      apiKey: 'token-2',
      defaultOutputFormat: 'image/png',
    },
  },
  models: [
    {
      id: 'model-async',
      displayName: 'Async Worker',
      remoteModelId: 'async-worker',
      enabled: true,
    },
  ],
};

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

    expect(screen.getByRole('button', { name: 'Add Supplier' })).toBeInTheDocument();
    expect(screen.getByText('No custom providers yet. Use the button above to add one.')).toBeInTheDocument();
  });

  it('renders protocol and enabled model summaries for each supplier row', () => {
    render(
      <CustomProvidersPage
        providers={[openApiProvider, xaisTaskProvider]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Acme Gateway')).toBeInTheDocument();
    expect(screen.getByText('Acme Gateway').parentElement).toHaveTextContent(
      'Access Protocol: OpenAPI Compatible'
    );
    expect(screen.getByText('Acme Gateway').parentElement).toHaveTextContent(
      'Available Models: Nano Banana Pro 2K'
    );
    expect(screen.getByText('Async Gateway')).toBeInTheDocument();
    expect(screen.getByText('Async Gateway').parentElement).toHaveTextContent(
      'Access Protocol: XAIS Task'
    );
    expect(screen.getByText('Async Gateway').parentElement).toHaveTextContent(
      'Available Models: Async Worker'
    );
    expect(screen.queryByText('Disabled Model')).not.toBeInTheDocument();
  });

  it('renders supplier rows and forwards add/edit/delete actions', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <CustomProvidersPage
        providers={[openApiProvider]}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('Acme Gateway')).toBeInTheDocument();
    expect(screen.getByText('Acme Gateway').parentElement).toHaveTextContent(
      'Access Protocol: OpenAPI Compatible'
    );
    expect(screen.getByText('Acme Gateway').parentElement).toHaveTextContent(
      'Available Models: Nano Banana Pro 2K'
    );
    expect(screen.queryByText('Disabled Model')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Supplier' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith('gateway-a');
    expect(onDelete).toHaveBeenCalledWith('gateway-a');
  });
});
