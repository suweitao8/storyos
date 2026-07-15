import { describe, expect, it } from "vitest";

import {
  buildProductionTaskStatusPath,
  getProductionTaskFeedback,
} from "./use-production-task-status";

describe("production task status helpers", () => {
  it("builds a scoped status endpoint for a scene task", () => {
    expect(buildProductionTaskStatusPath("/shorts/story-1/production", {
      kind: "scene-video",
      sceneIndex: 3,
    })).toBe("/shorts/story-1/production/tasks?kind=scene-video&sceneIndex=3");
  });

  it("builds a scoped status endpoint for an asset task", () => {
    expect(buildProductionTaskStatusPath("/stories/short/story-1/assets", {
      kind: "asset-image",
      assetId: "hero one",
    })).toBe("/stories/short/story-1/assets/tasks?kind=asset-image&assetId=hero+one");
  });

  it("keeps an active task pending and exposes a durable failure", () => {
    expect(getProductionTaskFeedback({ status: "running" })).toEqual({ pending: true, error: null });
    expect(getProductionTaskFeedback({ status: "failed", error: "provider unavailable" })).toEqual({
      pending: false,
      error: "provider unavailable",
    });
  });
});
