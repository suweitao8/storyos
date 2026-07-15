import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

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
  payload?: Readonly<Record<string, unknown>>;
  status: ProductionTaskStatus;
}

type TaskUpdateListener = (task: ProductionTask) => void;

export interface ProductionTaskRegistryOptions {
  readonly persistencePath?: string;
}

export interface ProductionTaskStartOptions {
  readonly payload?: Readonly<Record<string, unknown>>;
}

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
  private readonly latestTaskIds = new Map<string, string>();
  private readonly tasks = new Map<string, ProductionTask>();
  private readonly persistencePath?: string;
  private persistenceQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly onUpdate?: TaskUpdateListener,
    options: ProductionTaskRegistryOptions = {},
  ) {
    this.persistencePath = options.persistencePath;
    this.hydrate();
  }

  get(id: string): ProductionTask | undefined {
    const task = this.tasks.get(id);
    return task ? { ...task } : undefined;
  }

  latest(target: ProductionTaskTarget): ProductionTask | undefined {
    const id = this.latestTaskIds.get(taskKey(target));
    return id ? this.get(id) : undefined;
  }

  start(target: ProductionTaskTarget, run: () => Promise<void>, options: ProductionTaskStartOptions = {}): ProductionTask {
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
      ...(options.payload ? { payload: { ...options.payload } } : {}),
      status: "running",
    };
    this.tasks.set(task.id, task);
    this.activeTaskIds.set(key, task.id);
    this.latestTaskIds.set(key, task.id);
    this.emit(task);
    this.persist();

    this.attach(task, key, run);
    return { ...task };
  }

  /** Re-run tasks that were marked running when the previous server stopped. */
  resumePending(runFactory: (task: ProductionTask) => Promise<void>): void {
    for (const task of this.tasks.values()) {
      if (task.status !== "running") continue;
      const key = taskKey(task);
      if (this.activeTaskIds.get(key) !== task.id) continue;
      this.attach(task, key, () => runFactory({ ...task }));
    }
  }

  /** Wait until the last durable task snapshot has been written. */
  async flush(): Promise<void> {
    await this.persistenceQueue;
  }

  private attach(task: ProductionTask, key: string, run: () => Promise<void>): void {
    let work: Promise<void>;
    try {
      work = run();
    } catch (error) {
      this.fail(task, key, error);
      return;
    }

    void Promise.resolve(work).then(
      () => this.complete(task, key),
      (error: unknown) => this.fail(task, key, error),
    );
  }

  private complete(task: ProductionTask, key: string): void {
    if (task.status !== "running") return;
    task.completedAt = new Date().toISOString();
    task.status = "completed";
    this.activeTaskIds.delete(key);
    this.emit(task);
    this.persist();
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
    this.persist();
  }

  private hydrate(): void {
    if (!this.persistencePath) return;
    try {
      const parsed = JSON.parse(readFileSync(this.persistencePath, "utf-8")) as unknown;
      if (!Array.isArray(parsed)) return;
      for (const value of parsed) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const task = value as Partial<ProductionTask>;
        if (typeof task.id !== "string" || typeof task.createdAt !== "string" || typeof task.storyId !== "string" || typeof task.storyKind !== "string" || typeof task.kind !== "string") continue;
        if (task.status !== "running" && task.status !== "completed" && task.status !== "failed") continue;
        const hydrated = { ...task } as ProductionTask;
        const key = taskKey(hydrated);
        this.tasks.set(hydrated.id, hydrated);
        this.latestTaskIds.set(key, hydrated.id);
        if (hydrated.status === "running") this.activeTaskIds.set(key, hydrated.id);
      }
    } catch {
      // A missing or interrupted snapshot must not prevent Studio startup.
    }
  }

  private persist(): void {
    if (!this.persistencePath) return;
    const snapshot = [...this.tasks.values()].map((task) => ({ ...task }));
    this.persistenceQueue = this.persistenceQueue.then(async () => {
      await mkdir(dirname(this.persistencePath!), { recursive: true });
      const temporaryPath = `${this.persistencePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(snapshot, null, 2), "utf-8");
      await rename(temporaryPath, this.persistencePath!);
    }).catch(() => undefined);
  }
}
