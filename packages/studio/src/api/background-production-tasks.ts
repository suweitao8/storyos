export type ProductionTaskKind = "script" | "video" | "scene-video" | "asset-extract" | "asset-image" | "asset-batch";
export type ProductionStoryKind = "book" | "short";
export type ProductionTaskStatus = "completed" | "failed" | "running";

export interface ProductionTaskTarget {
  assetId?: string;
  kind: ProductionTaskKind;
  sceneIndex?: number;
  storyId: string;
  storyKind: ProductionStoryKind;
}

export interface ProductionTask extends ProductionTaskTarget {
  completedAt?: string;
  createdAt: string;
  error?: string;
  id: string;
  status: ProductionTaskStatus;
}

type TaskUpdateListener = (task: ProductionTask) => void;

function taskKey(target: ProductionTaskTarget): string {
  return [target.storyKind, target.storyId, target.kind, target.sceneIndex ?? "", target.assetId ?? ""].join(":");
}

function taskId(): string {
  return `production-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Keeps production work alive independently from the request/page that started it.
 * The registry is deliberately in-memory: production results remain the source of
 * truth, while this only supplies live status and duplicate-work protection.
 */
export class ProductionTaskRegistry {
  private readonly activeTaskIds = new Map<string, string>();
  private readonly tasks = new Map<string, ProductionTask>();

  constructor(private readonly onUpdate?: TaskUpdateListener) {}

  get(id: string): ProductionTask | undefined {
    const task = this.tasks.get(id);
    return task ? { ...task } : undefined;
  }

  start(target: ProductionTaskTarget, run: () => Promise<void>): ProductionTask {
    const key = taskKey(target);
    const activeId = this.activeTaskIds.get(key);
    const activeTask = activeId ? this.tasks.get(activeId) : undefined;
    if (activeTask?.status === "running") {
      return { ...activeTask };
    }

    const task: ProductionTask = {
      ...target,
      createdAt: new Date().toISOString(),
      id: taskId(),
      status: "running",
    };
    this.tasks.set(task.id, task);
    this.activeTaskIds.set(key, task.id);
    this.emit(task);

    let work: Promise<void>;
    try {
      work = run();
    } catch (error) {
      this.fail(task, key, error);
      return { ...task };
    }

    void Promise.resolve(work).then(
      () => this.complete(task, key),
      (error: unknown) => this.fail(task, key, error),
    );
    return { ...task };
  }

  private complete(task: ProductionTask, key: string): void {
    if (task.status !== "running") return;
    task.completedAt = new Date().toISOString();
    task.status = "completed";
    this.activeTaskIds.delete(key);
    this.emit(task);
  }

  private emit(task: ProductionTask): void {
    this.onUpdate?.({ ...task });
  }

  private fail(task: ProductionTask, key: string, error: unknown): void {
    if (task.status !== "running") return;
    task.completedAt = new Date().toISOString();
    task.error = errorMessage(error);
    task.status = "failed";
    this.activeTaskIds.delete(key);
    this.emit(task);
  }
}
