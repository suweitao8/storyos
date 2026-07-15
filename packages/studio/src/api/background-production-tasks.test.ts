import { describe, expect, it, vi } from "vitest";

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
});
