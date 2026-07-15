import { describe, expect, it } from "vitest";
import { Hono } from "hono";

import { registerStoryProductionRoutes } from "./story-production";
import type { StudioRouteContext } from "./context";

function createRouteContext() {
  const app = new Hono();
  const broadcasts: Array<{ event: string; data: unknown }> = [];
  const context = {
    app,
    root: "D:/StoryOS-test-runtime",
    broadcast: (event: string, data: unknown) => broadcasts.push({ event, data }),
  } as unknown as StudioRouteContext;
  registerStoryProductionRoutes(context);
  return { app, broadcasts };
}

describe("story production background routes", () => {
  it("accepts duplicate script requests immediately and reuses one running task", async () => {
    const { app, broadcasts } = createRouteContext();
    const request = () => app.request("/api/v1/shorts/backgroundcheck/production/script?background=true", {
      body: "{}",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    const first = await request();
    const second = await request();
    const firstBody = await first.json() as { task: { id: string; status: string } };
    const secondBody = await second.json() as { task: { id: string; status: string } };

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(firstBody.task.status).toBe("running");
    expect(secondBody.task.id).toBe(firstBody.task.id);
    expect(broadcasts).toContainEqual(expect.objectContaining({
      event: "production:task",
      data: expect.objectContaining({ id: firstBody.task.id, status: "running" }),
    }));
  });
});
