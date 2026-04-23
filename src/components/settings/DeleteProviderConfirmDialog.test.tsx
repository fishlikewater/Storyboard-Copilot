import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeleteProviderConfirmDialog } from './DeleteProviderConfirmDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      key === 'settings.deleteSupplierConfirm'
        ? `settings.deleteSupplierConfirm:${params?.name ?? ''}`
        : key,
  }),
}));

vi.mock('@/components/ui/useDialogTransition', () => ({
  useDialogTransition: (isOpen: boolean) => ({
    shouldRender: isOpen,
    isVisible: isOpen,
  }),
}));

describe('DeleteProviderConfirmDialog', () => {
  it('requires explicit confirmation before delete', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <DeleteProviderConfirmDialog
        isOpen
        providerName="Acme Gateway"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('settings.deleteSupplierConfirm:Acme Gateway')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'settings.confirmDeleteSupplier' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
