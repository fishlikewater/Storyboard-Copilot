import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSettingsStore } from '@/stores/settingsStore';

import { PromptManagementDialog } from './PromptManagementDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      if (key === 'promptTemplates.deleteDescription' && options?.title) {
        return `promptTemplates.deleteDescription:${options.title}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/components/ui/useDialogTransition', () => ({
  useDialogTransition: (isOpen: boolean) => ({
    shouldRender: isOpen,
    isVisible: isOpen,
  }),
}));

describe('PromptManagementDialog', () => {
  beforeEach(() => {
    useSettingsStore.setState({ promptTemplates: [] });
  });

  it('shows the empty state when no templates exist', () => {
    render(<PromptManagementDialog isOpen onClose={vi.fn()} />);

    expect(screen.getByText('promptTemplates.empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'promptTemplates.add' })).toBeInTheDocument();
  });

  it('uses settings-like dialog dimensions with an internal scroll area', () => {
    useSettingsStore.setState({
      promptTemplates: Array.from({ length: 8 }, (_, index) => ({
        id: `prompt-${index}`,
        title: `template-${index}`,
        content: `content-${index}`,
      })),
    });

    render(<PromptManagementDialog isOpen onClose={vi.fn()} />);

    const dialogPanel = Array.from(document.querySelectorAll('div')).find((element) => {
      const className = typeof element.className === 'string' ? element.className : '';
      return className.includes('w-[700px]') && className.includes('h-[500px]');
    });

    expect(dialogPanel).toBeTruthy();
    expect(screen.getByTestId('prompt-management-scroll-area')).toHaveClass('overflow-y-auto');
  });

  it('uses accent-driven styles for primary actions and empty state', async () => {
    const user = userEvent.setup();

    render(<PromptManagementDialog isOpen onClose={vi.fn()} />);

    const addButton = screen.getByRole('button', { name: 'promptTemplates.add' });
    expect(addButton.className).toContain('bg-accent');

    const emptyState = screen.getByText('promptTemplates.empty').closest('div');
    expect(emptyState?.className).toContain('border-accent/20');

    await user.click(addButton);

    expect(screen.getByRole('button', { name: 'common.save' }).className).toContain('bg-accent');
  });

  it('adds a new template and refreshes the list immediately', async () => {
    const user = userEvent.setup();

    render(<PromptManagementDialog isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'promptTemplates.add' }));
    await user.type(screen.getByLabelText('promptTemplates.editor.titleLabel'), '写实人像');
    await user.type(
      screen.getByLabelText('promptTemplates.editor.contentLabel'),
      'cinematic portrait'
    );
    await user.click(screen.getByRole('button', { name: 'common.save' }));

    expect(useSettingsStore.getState().promptTemplates).toHaveLength(1);
    expect(screen.getByText('写实人像')).toBeInTheDocument();
  });

  it('edits an existing template and shows the latest content summary', async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({
      promptTemplates: [
        {
          id: 'prompt-a',
          title: '写实人像',
          content: 'old content',
        },
      ],
    });

    render(<PromptManagementDialog isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'common.edit' }));
    await user.clear(screen.getByLabelText('promptTemplates.editor.contentLabel'));
    await user.type(screen.getByLabelText('promptTemplates.editor.contentLabel'), 'new content');
    await user.click(screen.getByRole('button', { name: 'common.save' }));

    expect(useSettingsStore.getState().promptTemplates[0].content).toBe('new content');
    expect(screen.getByText('new content')).toBeInTheDocument();
  });

  it('requires delete confirmation before removing a template', async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({
      promptTemplates: [
        {
          id: 'prompt-a',
          title: '写实人像',
          content: 'content',
        },
      ],
    });

    render(<PromptManagementDialog isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'common.delete' }));

    expect(
      screen.getByText('promptTemplates.deleteDescription:写实人像')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'common.confirm' }));

    expect(useSettingsStore.getState().promptTemplates).toEqual([]);
    expect(screen.queryByText('写实人像')).not.toBeInTheDocument();
  });
});
