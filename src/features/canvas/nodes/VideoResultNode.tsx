import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  CANVAS_NODE_TYPES,
  type VideoResultNodeData,
} from '@/features/canvas/domain/canvasNodes';
import { resolveNodeDisplayName } from '@/features/canvas/domain/nodeDisplay';
import { NodeHeader, NODE_HEADER_FLOATING_POSITION_CLASS } from '@/features/canvas/ui/NodeHeader';
import { canvasAiGateway } from '@/features/canvas/application/canvasServices';
import { useCanvasStore } from '@/stores/canvasStore';

type VideoResultNodeProps = NodeProps & {
  id: string;
  data: VideoResultNodeData;
};

const VIDEO_RESULT_MIN_WIDTH = 320;
const VIDEO_RESULT_MIN_HEIGHT = 240;

export const VideoResultNode = memo(function VideoResultNode({
  id,
  data,
}: VideoResultNodeProps) {
  const { t } = useTranslation();
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);

  const videoUrl = data.videoUrl ?? null;
  const status = data.status ?? 'running';
  const isRefreshing = data.isRefreshing === true;
  const displayName = resolveNodeDisplayName(CANVAS_NODE_TYPES.videoResult, data);

  const handleRefresh = useCallback(async () => {
    const jobId = data.jobId;
    if (!jobId || isRefreshing) {
      return;
    }

    updateNodeData(id, { isRefreshing: true });

    try {
      const result = await canvasAiGateway.getVideoGenerationJob(jobId);
      if (result.status === 'succeeded' && result.result) {
        updateNodeData(id, {
          videoUrl: result.result,
          status: 'succeeded',
          isRefreshing: false,
          isGenerating: false,
        });
      } else if (result.status === 'failed') {
        updateNodeData(id, {
          status: 'failed',
          isRefreshing: false,
          isGenerating: false,
        });
      } else {
        updateNodeData(id, { isRefreshing: false });
      }
    } catch (error) {
      console.error('[VideoResultNode] refresh failed', error);
      updateNodeData(id, { isRefreshing: false });
    }
  }, [id, data.jobId, isRefreshing, updateNodeData]);

  return (
    <div
      className="relative flex flex-col rounded-lg border border-border-dark bg-surface-dark shadow-md"
      style={{ minWidth: VIDEO_RESULT_MIN_WIDTH, minHeight: VIDEO_RESULT_MIN_HEIGHT }}
    >
      <NodeHeader
        title={displayName}
        className={NODE_HEADER_FLOATING_POSITION_CLASS}
      />

      <div className="flex flex-1 flex-col gap-2 p-3 pt-8">
        <div className="relative flex-1 overflow-hidden rounded border border-border-dark bg-bg-dark">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full min-h-[160px] items-center justify-center">
              <div className="text-center text-text-muted">
                {status === 'failed' ? (
                  <span className="text-xs">{t('node.videoResult.failed', '生成失败')}</span>
                ) : (
                  <span className="text-xs">{t('node.videoResult.generating', '视频生成中...')}</span>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing || status === 'succeeded'}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-border-dark bg-surface-dark px-3 text-xs text-text-dark transition-colors hover:bg-bg-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t('node.videoResult.refresh', '刷新')}
        </button>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-border-dark !bg-accent"
      />
    </div>
  );
});
