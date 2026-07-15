/**
 * 模块级"后台创建任务"注册表。
 *
 * 用户点击"创建故事"后，请求通过 fire-and-forget 方式发出，
 * 用户可以自由切换页面。当 SSE 推送 agent:complete（或 book:created）时，
 * 全局监听器查这个表，执行收尾步骤（script/assets 提取、toast 通知、导航）。
 *
 * 注册表是模块级单例，不受组件生命周期影响——即使 ChatPage 卸载，
 * pending 任务仍然能被正确处理。
 */
export type StoryKind = "book" | "short";

export interface PendingCreation {
  readonly sessionId: string;
  readonly kind: StoryKind;
  readonly title: string;
  /** 加入时间戳，用于超时清理 */
  readonly createdAt: number;
}

type CreationCompletedHandler = (entry: PendingCreation, result: { readonly storyId: string | null }) => void;
type CreationFailedHandler = (entry: PendingCreation, error: string) => void;

/**
 * 长篇或多轮短篇生产会经过设定、提纲、初稿、审稿与改稿等多个模型阶段。
 * 注册表必须覆盖整个后台任务窗口，否则完成事件到达时无法继续触发脚本和资产生成。
 */
export const PENDING_CREATION_TIMEOUT_MS = 60 * 60 * 1000; // 1 小时

const registry = new Map<string, PendingCreation>();
const completedHandlers = new Set<CreationCompletedHandler>();
const failedHandlers = new Set<CreationFailedHandler>();

/** 注册一个后台创建任务。重复注册同一 session 会覆盖。 */
export function registerPendingCreation(entry: PendingCreation): void {
  registry.set(entry.sessionId, entry);
}

/** 取消注册（例如创建中途被取消）。 */
export function unregisterPendingCreation(sessionId: string): void {
  registry.delete(sessionId);
}

/** 查找指定 session 的 pending 任务。 */
export function getPendingCreation(sessionId: string): PendingCreation | undefined {
  const entry = registry.get(sessionId);
  if (!entry) return undefined;
  // 超时自动清理
  if (Date.now() - entry.createdAt > PENDING_CREATION_TIMEOUT_MS) {
    registry.delete(sessionId);
    return undefined;
  }
  return entry;
}

/** 标记创建完成，触发已注册的 handler，并从注册表中移除。 */
export function completePendingCreation(sessionId: string, storyId: string | null): void {
  const entry = registry.get(sessionId);
  if (!entry) return;
  registry.delete(sessionId);
  for (const handler of completedHandlers) {
    handler(entry, { storyId });
  }
}

/** 标记创建失败，触发已注册的 handler，并从注册表中移除。 */
export function failPendingCreation(sessionId: string, error: string): void {
  const entry = registry.get(sessionId);
  if (!entry) return;
  registry.delete(sessionId);
  for (const handler of failedHandlers) {
    handler(entry, error);
  }
}

export function onCreationCompleted(handler: CreationCompletedHandler): () => void {
  completedHandlers.add(handler);
  return () => { completedHandlers.delete(handler); };
}

export function onCreationFailed(handler: CreationFailedHandler): () => void {
  failedHandlers.add(handler);
  return () => { failedHandlers.delete(handler); };
}
