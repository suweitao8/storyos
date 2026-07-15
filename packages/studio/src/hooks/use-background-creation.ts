import { useEffect } from "react";
import type { SSEMessage } from "./use-sse";
import { useNewSSEMessages } from "./use-sse";
import {
  completePendingCreation,
  failPendingCreation,
  getPendingCreation,
  onCreationCompleted,
  onCreationFailed,
  type PendingCreation,
} from "../store/story-creation/registry";
import { useChatStore } from "../store/chat";
import { latestShortStoryId } from "../pages/ChatPage";
import { fetchJson, invalidateApiPaths } from "./use-api";
import { toast } from "../store/toast/store";
import { tr } from "../lib/app-language";
import type { ProductionTask } from "../api/background-production-tasks";

export function productionTaskInvalidationPaths(task: Pick<ProductionTask, "kind" | "storyId" | "storyKind">): ReadonlyArray<string> {
  const storyId = encodeURIComponent(task.storyId);
  if (task.kind === "asset-extract" || task.kind === "asset-image" || task.kind === "asset-batch") {
    return [`/api/v1/stories/${task.storyKind}/${storyId}/assets`];
  }
  const collection = task.storyKind === "book" ? "books" : "shorts";
  return [`/api/v1/${collection}/${storyId}/production`];
}

/**
 * 全局监听 SSE 事件，驱动后台创建任务的收尾：
 * - agent:complete — agent 运行结束，执行 script/assets 提取 + 弹成功 toast
 * - agent:error / book:error — 创建失败，弹错误 toast
 *
 * 这个 hook 挂在 App 级别（不随路由卸载），确保用户切换页面时后台任务仍能完成。
 */
export function useBackgroundCreation(sse: { messages: ReadonlyArray<SSEMessage> }): void {
  // 注册全局完成/失败回调（只注册一次）
  useEffect(() => {
    const unsubscribeCompleted = onCreationCompleted(async (entry, result) => {
      const { kind, title } = entry;

      // 后台执行 script 和 assets 提取（不阻塞 UI）
      if (result.storyId) {
        void runPostCreationSteps(kind, result.storyId);
      }

      if (kind === "book") {
        toast.success(
          tr("故事已创建", "Story created"),
          title ? tr(`《${title}》已就绪，可以开始写作了`, `"${title}" is ready to write`) : undefined,
        );
      } else {
        toast.success(
          tr("短篇已创建", "Short story created"),
          title ? tr(`《${title}》已生成`, `"${title}" has been generated`) : undefined,
        );
      }
    });

    const unsubscribeFailed = onCreationFailed((_entry, error) => {
      toast.error(tr("创建失败", "Creation failed"), error);
    });

    return () => {
      unsubscribeCompleted();
      unsubscribeFailed();
    };
  }, []);

  // 消费 SSE 事件
  useNewSSEMessages(sse.messages, (recent) => {
    if (recent.event === "craft:story-seed-complete") {
      invalidateApiPaths(["/api/v1/crafts"]);
      toast.success(tr("故事设定已生成", "Story foundation generated"), tr("写作模式已更新，可继续创建故事", "The writing mode is updated and ready for story creation."));
      return;
    }

    if (recent.event === "craft:story-seed-error") {
      const data = recent.data as { error?: string } | null;
      invalidateApiPaths(["/api/v1/crafts"]);
      toast.error(tr("故事设定生成失败", "Story foundation generation failed"), data?.error);
      return;
    }

    if (recent.event === "craft:story-seed-score-complete") {
      const data = recent.data as { score?: number } | null;
      invalidateApiPaths(["/api/v1/crafts"]);
      const detail = typeof data?.score === "number"
        ? tr(`质量评分 ${data.score}`, `Quality score ${data.score}`)
        : undefined;
      toast.info(tr("故事设定评分完成", "Story foundation scoring completed"), detail);
      return;
    }

    if (recent.event === "craft:story-seed-score-error") {
      const data = recent.data as { error?: string } | null;
      invalidateApiPaths(["/api/v1/crafts"]);
      toast.error(tr("故事设定评分失败", "Story foundation scoring failed"), data?.error);
      return;
    }

    if (recent.event === "production:task") {
      const task = recent.data as ProductionTask | null;
      if (!task?.id) return;
      if (task.status !== "running") {
        invalidateApiPaths(productionTaskInvalidationPaths(task));
      }
      const label = task.kind === "script"
        ? tr("剧本", "script")
        : task.kind === "video"
          ? tr("合集视频", "collection video")
        : task.kind === "scene-video"
            ? tr("场景视频", "scene video")
            : task.kind === "asset-extract"
              ? tr("故事资产", "story assets")
            : task.kind === "asset-image"
              ? tr("资产图片", "asset image")
              : tr("资产图片批量生成", "asset image batch");
      if (task.status === "running") {
        toast.info(tr("已转入后台生成", "Generation started in background"), tr(`${label}会继续生成，可自由切换页面`, `${label} will keep running while you navigate.`));
      } else if (task.status === "completed") {
        toast.success(tr("后台生成完成", "Background generation completed"), label);
      } else if (task.status === "failed") {
        toast.error(tr("后台生成失败", "Background generation failed"), task.error ?? label);
      }
      return;
    }

    if (recent.event === "agent:complete") {
      const data = recent.data as { sessionId?: string; activeBookId?: string } | null;
      if (!data?.sessionId) return;
      const pending = getPendingCreation(data.sessionId);
      if (!pending) return;
      // 确定创建的 story ID
      const session = useChatStore.getState().sessions[data.sessionId];
      let storyId: string | null = null;
      if (pending.kind === "book") {
        storyId = data.activeBookId ?? session?.bookId ?? null;
      } else {
        storyId = latestShortStoryId(session?.messages ?? []);
      }
      completePendingCreation(data.sessionId, storyId);
      return;
    }

    if (recent.event === "agent:error") {
      const data = recent.data as { sessionId?: string; error?: string } | null;
      if (!data?.sessionId) return;
      if (!getPendingCreation(data.sessionId)) return;
      failPendingCreation(data.sessionId, data.error ?? "Unknown error");
      return;
    }

    if (recent.event === "book:error") {
      const data = recent.data as { sessionId?: string; error?: string } | null;
      if (!data?.sessionId) return;
      if (!getPendingCreation(data.sessionId)) return;
      failPendingCreation(data.sessionId, data.error ?? "Book creation failed");
      return;
    }
  });
}

/** 启动创建后的服务端后台链路；浏览器不负责串联耗时阶段。 */
export async function runPostCreationSteps(kind: "book" | "short", storyId: string): Promise<void> {
  const assetBasePath = `/stories/${kind}/${encodeURIComponent(storyId)}`;

  // 服务端任务会在资产提取成功后自动排队剧本生成；前端只发起一次任务，
  // 因此切页、刷新甚至关闭浏览器都不会截断阶段链路。
  try {
    await fetchJson(`${assetBasePath}/assets/extract?background=true`, { method: "POST" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(
      tr("资产提取失败", "Asset extraction failed"),
      message,
    );
  }
}

// PendingCreation 类型在本文件中通过 registry 间接使用，保留类型引用避免 tsc 清理
export type { PendingCreation };
