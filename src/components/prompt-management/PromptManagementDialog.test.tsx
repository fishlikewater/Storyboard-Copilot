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
