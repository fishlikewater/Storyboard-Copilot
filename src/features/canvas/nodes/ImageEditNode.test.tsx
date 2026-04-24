import type { MouseEventHandler, ReactNode } from 'react';

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImageEditNodeData } from '@/features/canvas/domain/canvasNodes';
import { useCanvasStore } from '@/stores/canvasStore';
import { DEFAULT_GRSAI_NANO_BANANA_PRO_MODEL, useSettingsStore } from '@/stores/settingsStore';

import { ImageEditNode } from './ImageEditNode';

vi.mock('@xyflow/react', () => ({
  Handle: ({ type, id }: { type: string; id?: string }) => (
    <div data-testid={`handle-${type}-${id ?? 'default'}`} />
  ),
  Position: {
    Left: 'left',
    Right: 'right',
  },
  useUpdateNodeInternals: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'zh-CN',
    },
  }),
}));

vi.mock('@/features/canvas/domain/nodeDisplay', () => ({
  resolveNodeDisplayName: () => 'AI 图片',
}));

vi.mock('@/features/canvas/ui/NodeHeader', () => ({
  NodeHeader: ({ titleText, rightSlot }: { titleText?: string; rightSlot?: ReactNode }) => (
    <div data-testid="node-header">
      <span>{titleText}</span>
      {rightSlot}
    </div>
  ),
  NODE_HEADER_FLOATING_POSITION_CLASS: '',
}));

vi.mock('@/features/canvas/ui/NodeResizeHandle', () => ({
  NodeResizeHandle: () => <div data-testid="node-resize-handle" />,
}));

vi.mock('@/features/canvas/application/canvasServices', () => ({
  canvasAiGateway: {
    setApiKey: vi.fn(),
    submitGenerateImageJob: vi.fn(),
  },
  graphImageResolver: {
    collectInputImages: vi.fn(() => []),
  },
}));

vi.mock('@/features/canvas/application/errorDialog', () => ({
  resolveErrorContent: () => ({
    message: 'error',
    details: null,
  }),
  showErrorDialog: vi.fn(),
}));

vi.mock('@/features/canvas/application/imageData', () => ({
  detectAspectRatio: vi.fn(),
  parseAspectRatio: (value: string) => {
    const [width, height] = value.split(':').map(Number);
    return width / height;
  },
  resolveImageDisplayUrl: (value: string) => value,
}));

vi.mock('@/features/canvas/application/generationErrorReport', () => ({
  CURRENT_RUNTIME_SESSION_ID: 'runtime-session',
  buildGenerationErrorReport: vi.fn(() => 'report'),
  createReferenceImagePlaceholders: vi.fn(() => []),
  getRuntimeDiagnostics: vi.fn(async () => ({
    appVersion: '1.0.0',
    osName: 'test',
    osVersion: '1.0.0',
    osBuild: 'build',
    userAgent: 'vitest',
  })),
}));

vi.mock('@/features/canvas/application/referenceTokenEditing', () => ({
  findReferenceTokens: vi.fn(() => []),
  insertReferenceToken: vi.fn((text: string, cursor: number, marker: string) => ({
    nextText: `${text.slice(0, cursor)}${marker}${text.slice(cursor)}`,
    nextCursor: cursor + marker.length,
  })),
  removeTextRange: vi.fn((text: string, range: { start: number; end: number }) => ({
    nextText: `${text.slice(0, range.start)}${text.slice(range.end)}`,
    nextCursor: range.start,
  })),
  resolveReferenceAwareDeleteRange: vi.fn(() => null),
}));

vi.mock('@/features/canvas/application/runtimeGenerationContext', () => ({
  resolveGenerationContext: () => ({
    isConfigured: true,
    shouldSetApiKey: false,
    apiKey: '',
    providerRuntime: null,
    resumeProviderId: 'mock-provider',
  }),
}));

vi.mock('@/features/canvas/application/buildNodeGeneratePayload', () => ({
  buildNodeGeneratePayload: vi.fn(() => ({})),
}));

vi.mock('@/features/canvas/models', () => {
  const mockModel = {
    id: 'mock-model',
    displayName: 'Mock Model',
    providerId: 'mock-provider',
    aspectRatios: [{ value: '1:1', label: '1:1' }],
    expectedDurationMs: 60000,
    resolveRequest: () => ({
      requestModel: 'mock-model',
    }),
  };

  return {
    DEFAULT_IMAGE_MODEL_ID: 'mock-model',
    getRuntimeImageModel: vi.fn(() => mockModel),
    listRuntimeImageModels: vi.fn(() => [mockModel]),
    resolveImageModelResolution: vi.fn(() => ({
      value: '1K',
      label: '1K',
    })),
    resolveImageModelResolutions: vi.fn(() => [
      {
        value: '1K',
        label: '1K',
      },
    ]),
  };
});

vi.mock('@/features/canvas/models/image/grsai/nanoBananaPro', () => ({
  GRSAI_NANO_BANANA_PRO_MODEL_ID: 'grsai/nano-banana-pro',
}));

vi.mock('@/features/canvas/models/image/fal/nanoBanana2', () => ({
  FAL_NANO_BANANA_2_MODEL_ID: 'fal/nano-banana-2',
}));

vi.mock('@/features/canvas/models/image/kie/nanoBanana2', () => ({
  KIE_NANO_BANANA_2_MODEL_ID: 'kie/nano-banana-2',
}));

vi.mock('@/features/canvas/pricing', () => ({
  resolveModelPriceDisplay: vi.fn(() => null),
}));

vi.mock('@/features/canvas/ui/nodeControlStyles', () => ({
  NODE_CONTROL_CHIP_CLASS: 'chip',
  NODE_CONTROL_ICON_CLASS: 'icon',
  NODE_CONTROL_MODEL_CHIP_CLASS: 'model-chip',
  NODE_CONTROL_PARAMS_CHIP_CLASS: 'params-chip',
  NODE_CONTROL_PRIMARY_BUTTON_CLASS: 'primary-button',
}));

vi.mock('@/features/canvas/ui/ModelParamsControls', () => ({
  ModelParamsControls: () => <div data-testid="model-params-controls" />,
}));

vi.mock('@/features/canvas/ui/CanvasNodeImage', () => ({
  CanvasNodeImage: ({ alt }: { alt: string }) => <div>{alt}</div>,
}));

vi.mock('@/features/canvas/ui/NodePriceBadge', () => ({
  NodePriceBadge: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock('@/components/ui', () => ({
  UiButton: ({
    children,
    className,
    onClick,
  }: {
    children: ReactNode;
    className?: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

const initialSettingsState = useSettingsStore.getState();
const initialCanvasState = useCanvasStore.getState();

function createNodeData(overrides: Partial<ImageEditNodeData> = {}): ImageEditNodeData {
  return {
    imageUrl: null,
    aspectRatio: '1:1',
    prompt: '',
    model: 'mock-model',
    size: '1K',
    requestAspectRatio: 'auto',
    ...overrides,
  };
}

function renderNode(dataOverrides: Partial<ImageEditNodeData> = {}) {
  let view: ReturnType<typeof render>;

  act(() => {
    view = render(
      <ImageEditNode
        {...({
          id: 'node-1',
          data: createNodeData(dataOverrides),
          selected: false,
          width: 520,
          height: 320,
        } as any)}
      />
    );
  });

  return view!;
}

describe('ImageEditNode', () => {
  let updateNodeData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateNodeData = vi.fn();

    act(() => {
      useSettingsStore.setState(
        {
          ...initialSettingsState,
          apiKeys: {},
          customProviders: [],
          promptTemplates: [],
          grsaiNanoBananaProModel: DEFAULT_GRSAI_NANO_BANANA_PRO_MODEL,
          showNodePrice: false,
        },
        true
      );

      useCanvasStore.setState(
        {
          ...initialCanvasState,
          nodes: [],
          edges: [],
          selectedNodeId: null,
          setSelectedNode: vi.fn(),
          updateNodeData,
          addNode: vi.fn(() => 'generated-node'),
          findNodePosition: vi.fn(() => ({ x: 0, y: 0 })),
          addEdge: vi.fn(),
        },
        true
      );
    });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      useSettingsStore.setState(initialSettingsState, true);
      useCanvasStore.setState(initialCanvasState, true);
    });
  });

  it('无模板时隐藏快捷模板区', () => {
    renderNode();

    expect(screen.queryByTestId('image-edit-node-prompt-templates')).not.toBeInTheDocument();
  });

  it('有模板时显示快捷标题按钮', () => {
    useSettingsStore.setState(
      {
        ...useSettingsStore.getState(),
        promptTemplates: [
          { id: 'template-1', title: '电影感', content: '电影感氛围' },
          { id: 'template-2', title: '柔光', content: '柔和自然光' },
        ],
      },
      true
    );

    renderNode();

    expect(screen.getByTestId('image-edit-node-prompt-templates')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '电影感' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '柔光' })).toBeInTheDocument();
  });

  it('点击模板时空提示词直接写入模板内容', async () => {
    const user = userEvent.setup();

    useSettingsStore.setState(
      {
        ...useSettingsStore.getState(),
        promptTemplates: [{ id: 'template-1', title: '电影感', content: '电影感氛围' }],
      },
      true
    );

    renderNode({ prompt: '' });

    await user.click(screen.getByRole('button', { name: '电影感' }));

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('电影感氛围');
    });
    expect(updateNodeData).toHaveBeenCalledWith('node-1', { prompt: '电影感氛围' });
  });

  it('点击模板时非空提示词先空行再追加，且连续点击保持同步', async () => {
    const user = userEvent.setup();

    useSettingsStore.setState(
      {
        ...useSettingsStore.getState(),
        promptTemplates: [
          { id: 'template-1', title: '电影感', content: '电影感氛围' },
          { id: 'template-2', title: '柔光', content: '柔和自然光' },
        ],
      },
      true
    );

    renderNode({ prompt: '已有内容' });

    await user.click(screen.getByRole('button', { name: '电影感' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('已有内容\n\n电影感氛围');
    });

    await user.click(screen.getByRole('button', { name: '柔光' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('已有内容\n\n电影感氛围\n\n柔和自然光');
    });

    const promptCalls = updateNodeData.mock.calls.filter(
      (call): call is [string, { prompt: string }] =>
        call[0] === 'node-1' &&
        typeof call[1] === 'object' &&
        call[1] !== null &&
        'prompt' in call[1]
    );
    expect(promptCalls).toEqual([
      ['node-1', { prompt: '已有内容\n\n电影感氛围' }],
      ['node-1', { prompt: '已有内容\n\n电影感氛围\n\n柔和自然光' }],
    ]);
  });
});
