import { useEffect } from "react";

import type { ProductionTask, ProductionTaskKind } from "../api/background-production-tasks";
import { useApi } from "./use-api";

export interface ProductionTaskStatusResponse {
  readonly task: ProductionTask | null;
}

export interface ProductionTaskStatusTarget {
  readonly assetId?: string;
  readonly kind: ProductionTaskKind;
  readonly sceneIndex?: number;
}

export interface ProductionTaskFeedback {
  readonly error: string | null;
  readonly pending: boolean;
}

export function buildProductionTaskStatusPath(
  basePath: string,
  target: ProductionTaskStatusTarget,
): string {
  const params = new URLSearchParams({ kind: target.kind });
  if (target.sceneIndex !== undefined) params.set("sceneIndex", String(target.sceneIndex));
  if (target.assetId) params.set("assetId", target.assetId);
  return `${basePath}/tasks?${params.toString()}`;
}

export function getProductionTaskFeedback(
  task: Pick<ProductionTask, "error" | "status"> | null | undefined,
): ProductionTaskFeedback {
  if (task?.status === "running") return { pending: true, error: null };
  if (task?.status === "failed") {
    return { pending: false, error: task.error?.trim() || "Background generation failed." };
  }
  return { pending: false, error: null };
}

/**
 * Reads durable in-process background task state when a panel remounts, then
 * polls only while that task is active. Generated files remain the durable
 * product data; task state supplies reliable progress and failure feedback.
 */
export function useProductionTaskStatus(path: string) {
  const { data, loading, error, refetch } = useApi<ProductionTaskStatusResponse>(path);
  const task = data?.task ?? null;

  useEffect(() => {
    if (task?.status !== "running") return;
    const timer = window.setInterval(() => { void refetch(); }, 4_000);
    return () => window.clearInterval(timer);
  }, [refetch, task?.id, task?.status]);

  return { task, loading, error, refetch };
}
