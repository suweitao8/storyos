import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ProductionTaskRegistry } from "./background-production-tasks";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const taskTarget = {
  kind: "script" as const,
  storyId: "short-background-task",
  storyKind: "short" as const,
};

describe("ProductionTaskRegistry", () => {
  const temporaryRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("starts a production job without waiting for its completion", async () => {
    const updates: string[] = [];
    const registry = new ProductionTaskRegistry((task) => updates.push(task.status));
    const work = deferred<void>();
    const run = vi.fn(() => work.promise);

    const task = registry.start(taskTarget, run);

    expect(task.status).toBe("running");
    expect(run).toHaveBeenCalledTimes(1);
    expect(registry.get(task.id)?.status).toBe("running");

    work.resolve();
    await Promise.resolve();

    expect(registry.get(task.id)?.status).toBe("completed");
    expect(updates).toEqual(["running", "completed"]);
  });

  it("reuses the active task for the same production target", () => {
    const registry = new ProductionTaskRegistry();
    const work = deferred<void>();
    const firstRun = vi.fn(() => work.promise);
    const duplicateRun = vi.fn(async () => undefined);

    const first = registry.start(taskTarget, firstRun);
    const duplicate = registry.start(taskTarget, duplicateRun);

    expect(duplicate.id).toBe(first.id);
    expect(firstRun).toHaveBeenCalledTimes(1);
    expect(duplicateRun).not.toHaveBeenCalled();
  });

  it("does not merge image tasks for different assets in the same story", () => {
    const registry = new ProductionTaskRegistry();
    const heroWork = deferred<void>();
    const sceneWork = deferred<void>();

    const hero = registry.start({ ...taskTarget, assetId: "hero", kind: "asset-image" }, () => heroWork.promise);
    const scene = registry.start({ ...taskTarget, assetId: "warehouse", kind: "asset-image" }, () => sceneWork.promise);

    expect(scene.id).not.toBe(hero.id);
  });

  it("records a failed task instead of leaking its rejection", async () => {
    const registry = new ProductionTaskRegistry();
    const task = registry.start(taskTarget, async () => {
      throw new Error("generation failed");
    });

    await Promise.resolve();

    expect(registry.get(task.id)).toMatchObject({
      error: "generation failed",
      status: "failed",
    });
  });

  it("keeps the latest task for a production target after it reaches a terminal state", async () => {
    const registry = new ProductionTaskRegistry();
    const work = deferred<void>();
    const task = registry.start(taskTarget, () => work.promise);

    work.reject(new Error("provider unavailable"));
    await Promise.resolve();

    expect(registry.latest(taskTarget)).toMatchObject({
      id: task.id,
      error: "provider unavailable",
      status: "failed",
    });
  });

  it("persists task state and resumes a running task after a process restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "storyos-production-task-"));
    temporaryRoots.push(root);
    const persistencePath = join(root, "tasks.json");
    const firstWork = deferred<void>();
    const first = new ProductionTaskRegistry(undefined, { persistencePath });
    const task = first.start(taskTarget, () => firstWork.promise, { payload: { voice: false } });
    await first.flush();

    const secondWork = deferred<void>();
    const resumed = vi.fn((_task: typeof task) => secondWork.promise);
    const restarted = new ProductionTaskRegistry(undefined, { persistencePath });
    restarted.resumePending(resumed);

    expect(restarted.latest(taskTarget)).toMatchObject({
      id: task.id,
      status: "running",
      payload: { voice: false },
    });
    expect(resumed).toHaveBeenCalledWith(expect.objectContaining({ id: task.id, payload: { voice: false } }));

    secondWork.resolve();
    await Promise.resolve();
    await restarted.flush();

    expect(restarted.latest(taskTarget)).toMatchObject({ id: task.id, status: "completed" });
    firstWork.resolve();
    await Promise.resolve();
    await first.flush();
  });
});
