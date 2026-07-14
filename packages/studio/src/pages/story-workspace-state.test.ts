import { describe, expect, it } from "vitest";

import {
  buildStoryWorkspaceTabs,
  DEFAULT_STORY_WORKSPACE_STAGE,
  resolveStoryWorkspaceStage,
  STORY_WORKSPACE_STAGES,
} from "./story-workspace-state";

describe("story workspace stages", () => {
  it("opens story workspaces on the story list by default", () => {
    expect(DEFAULT_STORY_WORKSPACE_STAGE).toBe("list");
  });

  it("keeps all production stages in a stable order", () => {
    expect(STORY_WORKSPACE_STAGES).toEqual([
      "list",
      "create",
      "settings",
      "assets",
      "script",
      "video",
    ]);
  });

  it("defaults to settings and accepts every known stage", () => {
    expect(resolveStoryWorkspaceStage(undefined)).toBe("settings");
    expect(resolveStoryWorkspaceStage(null)).toBe("settings");
    expect(resolveStoryWorkspaceStage("list")).toBe("list");
    expect(resolveStoryWorkspaceStage("create")).toBe("create");
    expect(resolveStoryWorkspaceStage("settings")).toBe("settings");
    expect(resolveStoryWorkspaceStage("assets")).toBe("assets");
    expect(resolveStoryWorkspaceStage("adjust")).toBe("settings");
    expect(resolveStoryWorkspaceStage("script")).toBe("script");
    expect(resolveStoryWorkspaceStage("video")).toBe("video");
  });

  it("falls back to settings for an unknown stage", () => {
    expect(resolveStoryWorkspaceStage("unknown")).toBe("settings");
    expect(resolveStoryWorkspaceStage(" SETTINGS ")).toBe("settings");
  });

  it("builds enabled Chinese production tabs", () => {
    expect(buildStoryWorkspaceTabs(true)).toEqual([
      { id: "list", label: "故事列表" },
      { id: "create", label: "创建故事" },
      { id: "settings", label: "故事设定" },
      { id: "assets", label: "故事资产" },
      { id: "script", label: "剧本" },
      { id: "video", label: "视频" },
    ]);
  });

  it("builds enabled English production tabs", () => {
    expect(buildStoryWorkspaceTabs(false)).toEqual([
      { id: "list", label: "Story list" },
      { id: "create", label: "Create story" },
      { id: "settings", label: "Story Settings" },
      { id: "assets", label: "Story Assets" },
      { id: "script", label: "Script" },
      { id: "video", label: "Video" },
    ]);
  });
});
