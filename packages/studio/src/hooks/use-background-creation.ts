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
import { fetchJson } from "./use-api";
import { toast } from "../store/toast/store";
import { tr } from "../lib/app-language";

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

/** 执行创建后的 script + assets 提取（后台、不阻塞）。 */
async function runPostCreationSteps(kind: "book" | "short", storyId: string): Promise<void> {
  const basePath = kind === "book"
    ? `/stories/book/${storyId}`
    : `/stories/short/${storyId}`;

  // Script 创建（空故事没有 script，失败是正常的，静默忽略）
  try {
    await fetchJson(`${basePath}/script`, { method: "POST" });
  } catch {
    // 空故事还没有 script 源，正常
  }

  // Assets 提取（失败弹 toast 提示，但不阻断）
  try {
    await fetchJson(`${basePath}/assets/extract`, { method: "POST" });
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
