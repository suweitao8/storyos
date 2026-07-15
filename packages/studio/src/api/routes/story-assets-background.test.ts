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
});
