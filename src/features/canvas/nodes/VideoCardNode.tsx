import { memo, useCallback, useEffect, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  CANVAS_NODE_TYPES,
  IMAGE_ASPECT_RATIOS,
  IMAGE_SIZES,
  type ImageSize,
  type VideoCardNodeData,
} from '@/features/canvas/domain/canvasNodes';
import { resolveNodeDisplayName } from '@/features/canvas/domain/nodeDisplay';
import { NodeHeader, NODE_HEADER_FLOATING_POSITION_CLASS } from '@/features/canvas/ui/NodeHeader';
import { canvasAiGateway } from '@/features/canvas/application/canvasServices';
import { listRuntimeVideoModels } from '@/features/canvas/models';
import {
  NODE_CONTROL_PRIMARY_BUTTON_CLASS,
} from '@/features/canvas/ui/nodeControlStyles';
import { useCanvasStore } from '@/stores/canvasStore';
import { useSettingsStore } from '@/stores/settingsStore';

type VideoCardNodeProps = NodeProps & {
  id: string;
  data: VideoCardNodeData;
};

const VIDEO_CARD_MIN_WIDTH = 320;
const VIDEO_CARD_MIN_HEIGHT = 200;

export const VideoCardNode = memo(function VideoCardNode({
  id,
  data,
}: VideoCardNodeProps) {
  const { t } = useTranslation();
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const addNode = useCanvasStore((state) => state.addNode);
  const addEdge = useCanvasStore((state) => state.addEdge);
  const findNodePosition = useCanvasStore((state) => state.findNodePosition);
  const customProviders = useSettingsStore((state) => state.customProviders);

  const [localPrompt, setLocalPrompt] = useState(data.prompt ?? '');
  const [localModel, setLocalModel] = useState(data.model ?? '');
  const [localSize, setLocalSize] = useState<ImageSize>(data.size ?? '2K');
  const [localAspectRatio, setLocalAspectRatio] = useState(data.aspectRatio ?? '16:9');
  const isGenerating = data.isGenerating === true;

  const videoModels = listRuntimeVideoModels(customProviders);
  const displayName = resolveNodeDisplayName(CANVAS_NODE_TYPES.videoCard, data);

  useEffect(() => {
    setLocalPrompt(data.prompt ?? '');
  }, [data.prompt]);

  useEffect(() => {
    setLocalModel(data.model ?? '');
  }, [data.model]);

  const handleGenerate = useCallback(async () => {
    if (!localPrompt.trim() || !localModel || isGenerating) {
      return;
    }

    const model = videoModels.find((m) => m.id === localModel);
    if (!model) {
      return;
    }

    updateNodeData(id, {
      isGenerating: true,
      generationStartedAt: Date.now(),
    });

    try {
      const jobId = await canvasAiGateway.submitVideoGenerationJob({
        prompt: localPrompt,
        model: localModel,
        size: localSize,
        aspectRatio: localAspectRatio,
        providerRuntime: model.runtimeProvider,
      });

      updateNodeData(id, { generationJobId: jobId });

      const resultNodeId = addNode(CANVAS_NODE_TYPES.videoResult, findNodePosition(id, 400, 300), {
        videoUrl: null,
        jobId,
        status: 'running',
        aspectRatio: localAspectRatio,
        size: localSize,
        isRefreshing: false,
        generationJobId: jobId,
        isGenerating: true,
      });

      if (resultNodeId) {
        addEdge(id, resultNodeId);
      }
    } catch (error) {
      console.error('[VideoCardNode] submit failed', error);
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
    localSize,
    localAspectRatio,
    isGenerating,
    videoModels,
    updateNodeData,
    findNodePosition,
    addNode,
    addEdge,
  ]);

  return (
    <div
      className="relative flex flex-col rounded-lg border border-border-dark bg-surface-dark shadow-md"
      style={{ minWidth: VIDEO_CARD_MIN_WIDTH, minHeight: VIDEO_CARD_MIN_HEIGHT }}
    >
      <NodeHeader
        title={displayName}
        className={NODE_HEADER_FLOATING_POSITION_CLASS}
      />

      <div className="flex flex-1 flex-col gap-2 p-3 pt-8">
        <textarea
          value={localPrompt}
          onChange={(e) => {
            setLocalPrompt(e.target.value);
            updateNodeData(id, { prompt: e.target.value });
          }}
          placeholder={t('node.videoCard.promptPlaceholder', '输入视频描述...')}
          className="min-h-[80px] flex-1 resize-none rounded border border-border-dark bg-bg-dark px-3 py-2 text-sm text-text-dark placeholder:text-text-muted focus:border-accent focus:outline-none"
          disabled={isGenerating}
        />

        <div className="flex items-center gap-2">
          <select
            value={localModel}
            onChange={(e) => {
              setLocalModel(e.target.value);
              updateNodeData(id, { model: e.target.value });
            }}
            className="h-8 flex-1 rounded border border-border-dark bg-bg-dark px-2 text-xs text-text-dark focus:border-accent focus:outline-none"
            disabled={isGenerating}
          >
            <option value="">{t('node.imageNode.model', '模型')}</option>
            {videoModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.displayName}
              </option>
            ))}
          </select>

          <select
            value={localAspectRatio}
            onChange={(e) => {
              setLocalAspectRatio(e.target.value);
              updateNodeData(id, { aspectRatio: e.target.value });
            }}
            className="h-8 w-20 rounded border border-border-dark bg-bg-dark px-2 text-xs text-text-dark focus:border-accent focus:outline-none"
            disabled={isGenerating}
          >
            {IMAGE_ASPECT_RATIOS.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </select>

          <select
            value={localSize}
            onChange={(e) => {
              setLocalSize(e.target.value as ImageSize);
              updateNodeData(id, { size: e.target.value as ImageSize });
            }}
            className="h-8 w-16 rounded border border-border-dark bg-bg-dark px-2 text-xs text-text-dark focus:border-accent focus:outline-none"
            disabled={isGenerating}
          >
            {IMAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isGenerating || !localPrompt.trim() || !localModel}
          className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium text-white transition-colors ${NODE_CONTROL_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {isGenerating
            ? t('node.videoCard.generating', '生成中...')
            : t('canvas.generate', '生成')}
        </button>
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
