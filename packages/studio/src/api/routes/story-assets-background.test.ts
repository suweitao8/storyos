import { describe, expect, it } from "vitest";
import { Hono } from "hono";

import { registerStoryAssetRoutes } from "./story-assets";
import type { StudioRouteContext } from "./context";

describe("story asset background routes", () => {
  it("accepts extraction as a background production task", async () => {
    const app = new Hono();
    const broadcasts: Array<{ event: string; data: unknown }> = [];
    registerStoryAssetRoutes({
      app,
      root: "D:/StoryOS-test-runtime",
      broadcast: (event: string, data: unknown) => broadcasts.push({ event, data }),
    } as unknown as StudioRouteContext);

    const response = await app.request("/api/v1/stories/short/background-assets/assets/extract?background=true", {
      method: "POST",
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      task: {
        kind: "asset-extract",
        storyId: "background-assets",
        storyKind: "short",
        status: "running",
      },
    });
    expect(broadcasts).toContainEqual(expect.objectContaining({
      event: "production:task",
      data: expect.objectContaining({ kind: "asset-extract", status: "running" }),
    }));
  });

  it("exposes the latest asset task status for pages opened after the request", async () => {
    const app = new Hono();
    registerStoryAssetRoutes({
      app,
      root: "D:/StoryOS-test-runtime",
      broadcast: () => undefined,
    } as unknown as StudioRouteContext);

    const started = await app.request("/api/v1/stories/short/background-assets-status/assets/extract?background=true", {
      method: "POST",
    });
    const { task } = await started.json() as { task: { id: string } };

    const status = await app.request("/api/v1/stories/short/background-assets-status/assets/tasks?kind=asset-extract");

    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toMatchObject({
      task: { id: task.id, kind: "asset-extract", storyId: "background-assets-status" },
    });
  });
});
