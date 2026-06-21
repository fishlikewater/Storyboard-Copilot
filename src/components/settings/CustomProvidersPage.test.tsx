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
        'settings.customProviderProtocolOpenaiImage': 'OpenAI Image',
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
  protocol: 'openapi', mediaType: 'image',
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

const openAiImageProvider: CustomProviderConfig = {
  id: 'openai-images',
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
  models: [
    {
      id: 'gpt-image',
      displayName: 'GPT Image',
      remoteModelId: 'gpt-image-1',
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

  it('keeps the add supplier button from shrinking beside header text', () => {
    render(
      <CustomProvidersPage
        providers={[]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId('custom-providers-page-heading-copy')).toHaveClass('min-w-0');
    expect(screen.getByRole('button', { name: 'Add Supplier' })).toHaveClass('shrink-0');
  });

  it('renders protocol and enabled model summaries for each supplier row', () => {
    render(
      <CustomProvidersPage
        providers={[openApiProvider, openAiImageProvider]}
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
    expect(screen.getByText('OpenAI Images')).toBeInTheDocument();
    expect(screen.getByText('OpenAI Images').parentElement).toHaveTextContent(
      'Access Protocol: OpenAI Image'
    );
    expect(screen.getByText('OpenAI Images').parentElement).toHaveTextContent(
      'Available Models: GPT Image'
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
