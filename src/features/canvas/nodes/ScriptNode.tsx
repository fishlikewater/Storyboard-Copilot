import { memo, useCallback, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Scissors } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  CANVAS_NODE_TYPES,
  type ScriptNodeData,
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

type ScriptNodeProps = NodeProps & {
  id: string;
  data: ScriptNodeData;
};

const SCRIPT_NODE_MIN_WIDTH = 320;
const SCRIPT_NODE_MIN_HEIGHT = 200;

const SPLIT_PROMPT_TEMPLATE = `请将以下剧本拆分为分镜帧描述。每帧用一句话描述画面内容。
返回 JSON 数组格式，每个元素包含 "description" 字段。
只返回 JSON 数组，不要添加其他文字。

剧本内容：
{content}`;

export const ScriptNode = memo(function ScriptNode({
  id,
  data,
}: ScriptNodeProps) {
  const { t } = useTranslation();
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const addNode = useCanvasStore((state) => state.addNode);
  const addEdge = useCanvasStore((state) => state.addEdge);
  const findNodePosition = useCanvasStore((state) => state.findNodePosition);
  const customProviders = useSettingsStore((state) => state.customProviders);

  const [localContent, setLocalContent] = useState(data.content ?? '');
  const [localModel, setLocalModel] = useState(data.model ?? '');
  const isSplitting = data.isSplitting === true;

  const textModels = listRuntimeTextModels(customProviders);
  const displayName = resolveNodeDisplayName(CANVAS_NODE_TYPES.script, data);

  const handleContentChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setLocalContent(value);
      updateNodeData(id, { content: value });
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

  const handleSplitStoryboard = useCallback(async () => {
    if (!localContent.trim() || !localModel || isSplitting) {
      return;
    }

    const model = textModels.find((m) => m.id === localModel);
    if (!model) {
      return;
    }

    updateNodeData(id, { isSplitting: true });

    try {
      const splitPrompt = SPLIT_PROMPT_TEMPLATE.replace('{content}', localContent);
      const jobId = await canvasAiGateway.submitTextCompletionJob({
        prompt: splitPrompt,
        model: localModel,
        providerRuntime: model.runtimeProvider,
      });

      const pollInterval = setInterval(async () => {
        try {
          const status = await canvasAiGateway.getTextCompletionJob(jobId);
          if (status.status === 'succeeded' && status.result) {
            clearInterval(pollInterval);
            updateNodeData(id, { isSplitting: false });

            let frames: Array<{ description: string }> = [];
            try {
              const parsed = JSON.parse(status.result);
              if (Array.isArray(parsed)) {
                frames = parsed;
              }
            } catch {
              frames = [{ description: status.result }];
            }

            const FRAMES_PER_BOARD = 9;
            const boards = Math.ceil(frames.length / FRAMES_PER_BOARD) || 1;

            for (let boardIndex = 0; boardIndex < boards; boardIndex++) {
              const boardFrames = frames.slice(
                boardIndex * FRAMES_PER_BOARD,
                (boardIndex + 1) * FRAMES_PER_BOARD,
              );

              const gridCols = Math.min(3, boardFrames.length);
              const gridRows = Math.min(3, Math.ceil(boardFrames.length / gridCols));

              const storyboardNode = addNode(
                CANVAS_NODE_TYPES.storyboardSplit,
                findNodePosition(id, 500, 400),
                {
                  aspectRatio: '1:1',
                  frameAspectRatio: '1:1',
                  gridRows,
                  gridCols,
                  frames: boardFrames.map((frame, index) => ({
                    id: `frame-${Date.now()}-${index}`,
                    imageUrl: null,
                    previewImageUrl: null,
                    aspectRatio: '1:1',
                    note: frame.description,
                    order: index,
                  })),
                },
              );

              if (storyboardNode) {
                addEdge(id, storyboardNode);
              }
            }
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            updateNodeData(id, { isSplitting: false });
            console.error('[ScriptNode] split failed', status.error);
          }
        } catch (error) {
          console.warn('[ScriptNode] poll failed', error);
        }
      }, 1400);
    } catch (error) {
      console.error('[ScriptNode] split submit failed', error);
      updateNodeData(id, { isSplitting: false });
    }
  }, [
    id,
    localContent,
    localModel,
    isSplitting,
    textModels,
    updateNodeData,
    findNodePosition,
    addNode,
    addEdge,
  ]);

  return (
    <div
      className="relative flex flex-col rounded-lg border border-border-dark bg-surface-dark shadow-md"
      style={{ minWidth: SCRIPT_NODE_MIN_WIDTH, minHeight: SCRIPT_NODE_MIN_HEIGHT }}
    >
      <NodeHeader
        title={displayName}
        className={NODE_HEADER_FLOATING_POSITION_CLASS}
      />

      <div className="flex flex-1 flex-col gap-2 p-3 pt-8">
        <textarea
          value={localContent}
          onChange={handleContentChange}
          placeholder={t('node.script.contentPlaceholder', '剧本内容...')}
          className="min-h-[120px] flex-1 resize-none rounded border border-border-dark bg-bg-dark px-3 py-2 text-sm text-text-dark placeholder:text-text-muted focus:border-accent focus:outline-none"
          disabled={isSplitting}
        />

        <div className="flex items-center gap-2">
          <select
            value={localModel}
            onChange={handleModelChange}
            className="h-8 flex-1 rounded border border-border-dark bg-bg-dark px-2 text-xs text-text-dark focus:border-accent focus:outline-none"
            disabled={isSplitting}
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
            onClick={() => void handleSplitStoryboard()}
            disabled={isSplitting || !localContent.trim() || !localModel}
            className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium text-white transition-colors ${NODE_CONTROL_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Scissors className="h-3.5 w-3.5" />
            {isSplitting
              ? t('node.script.splitting', '拆分中...')
              : t('node.script.splitButton', '分镜')}
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
