import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TitleBar } from './TitleBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'zh-CN',
      changeLanguage: vi.fn(),
    },
  }),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
    startDragging: vi.fn(),
  }),
}));

vi.mock('@/stores/themeStore', () => ({
  useThemeStore: () => ({
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: (selector: (state: { currentProject: null }) => unknown) =>
    selector({ currentProject: null }),
}));

describe('TitleBar', () => {
  it('calls prompt management callback when the new button is clicked', async () => {
    const user = userEvent.setup();
    const onPromptManagementClick = vi.fn();

    render(
      <TitleBar
        onSettingsClick={vi.fn()}
        onPromptManagementClick={onPromptManagementClick}
      />
    );

    await user.click(screen.getByTitle('titleBar.promptManagement'));

    expect(onPromptManagementClick).toHaveBeenCalledTimes(1);
  });
});
