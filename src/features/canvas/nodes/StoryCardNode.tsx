import { memo, useCallback, useEffect, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  CANVAS_NODE_TYPES,
  type StoryCardNodeData,
} from '@/features/canvas/domain/canvasNodes';
import { resolveNodeDisplayName } from '@/features/canvas/domain/nodeDisplay';
import { NodeHeader, NODE_HEADER_FLOATING_POSITION_CLASS } from '@/features/canvas/ui/NodeHeader';
import { canvasAiGateway } from '@/features/canvas/application/canvasServices';
import { listRuntimeTextModels } from '@/features/canvas/models';
import {
  NODE_CONTROL_PRIMARY_BUTTON_CLASS,
} from '@/features/canvas/ui/nodeControlStyles';
import { useCanvasStore } from '@/stores/canvasStore';
import { useSettingsStore } from '@/stores/settingsStore';

type StoryCardNodeProps = NodeProps & {
  id: string;
  data: StoryCardNodeData;
};

const STORY_CARD_MIN_WIDTH = 320;
const STORY_CARD_MIN_HEIGHT = 180;

export const StoryCardNode = memo(function StoryCardNode({
  id,
  data,
}: StoryCardNodeProps) {
  const { t } = useTranslation();
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const addNode = useCanvasStore((state) => state.addNode);
  const addEdge = useCanvasStore((state) => state.addEdge);
  const findNodePosition = useCanvasStore((state) => state.findNodePosition);
  const customProviders = useSettingsStore((state) => state.customProviders);

  const [localPrompt, setLocalPrompt] = useState(data.prompt ?? '');
  const [localModel, setLocalModel] = useState(data.model ?? '');
  const isGenerating = data.isGenerating === true;

  const textModels = listRuntimeTextModels(customProviders);
  const displayName = resolveNodeDisplayName(CANVAS_NODE_TYPES.storyCard, data);

  useEffect(() => {
    setLocalPrompt(data.prompt ?? '');
  }, [data.prompt]);

  useEffect(() => {
    setLocalModel(data.model ?? '');
  }, [data.model]);

  const handlePromptChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setLocalPrompt(value);
      updateNodeData(id, { prompt: value });
    },
    [id, updateNodeData],
  );

  const handleModelChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setLocalModel(value);
      updateNodeData(id, { model: value });
    },
    [id, updateNodeData],
  );

  const handleGenerate = useCallback(async () => {
    if (!localPrompt.trim() || !localModel || isGenerating) {
      return;
    }

    const model = textModels.find((m) => m.id === localModel);
    if (!model) {
      return;
    }

    updateNodeData(id, {
      isGenerating: true,
      generationStartedAt: Date.now(),
    });

    try {
      const jobId = await canvasAiGateway.submitTextCompletionJob({
        prompt: localPrompt,
        model: localModel,
        providerRuntime: model.runtimeProvider,
      });

      updateNodeData(id, { generationJobId: jobId });

      const scriptNodeId = addNode(CANVAS_NODE_TYPES.script, findNodePosition(id, 420, 200), {
        content: '',
        model: localModel,
        sourceStoryCardId: id,
        isSplitting: false,
      });

      if (scriptNodeId) {
        addEdge(id, scriptNodeId);
      }
    } catch (error) {
      console.error('[StoryCardNode] submit failed', error);
      updateNodeData(id, {
        isGenerating: false,
        generationStartedAt: null,
        generationJobId: null,
      });
    }
  }, [
    id,
    localPrompt,
    localModel,
    isGenerating,
    textModels,
    updateNodeData,
    findNodePosition,
    addNode,
    addEdge,
  ]);

  return (
    <div
      className="relative flex flex-col rounded-lg border border-border-dark bg-surface-dark shadow-md"
      style={{ minWidth: STORY_CARD_MIN_WIDTH, minHeight: STORY_CARD_MIN_HEIGHT }}
    >
      <NodeHeader
        title={displayName}
        className={NODE_HEADER_FLOATING_POSITION_CLASS}
      />

      <div className="flex flex-1 flex-col gap-2 p-3 pt-8">
        <textarea
          value={localPrompt}
          onChange={handlePromptChange}
          placeholder={t('node.storyCard.promptPlaceholder', '输入故事描述...')}
          className="min-h-[80px] flex-1 resize-none rounded border border-border-dark bg-bg-dark px-3 py-2 text-sm text-text-dark placeholder:text-text-muted focus:border-accent focus:outline-none"
          disabled={isGenerating}
        />

        <div className="flex items-center gap-2">
          <select
            value={localModel}
            onChange={handleModelChange}
            className="h-8 flex-1 rounded border border-border-dark bg-bg-dark px-2 text-xs text-text-dark focus:border-accent focus:outline-none"
            disabled={isGenerating}
          >
            <option value="">{t('node.imageNode.model', '模型')}</option>
            {textModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.displayName}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isGenerating || !localPrompt.trim() || !localModel}
            className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium text-white transition-colors ${NODE_CONTROL_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isGenerating
              ? t('node.storyCard.generating', '生成中...')
              : t('canvas.generate', '生成')}
          </button>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-border-dark !bg-accent"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-border-dark !bg-accent"
      />
    </div>
  );
});
