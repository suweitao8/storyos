import { describe, expect, it } from "vitest";
import {
  createEmptyStoryAssetManifest,
  mergeStoryAssets,
  normalizeStoryAssetKind,
  normalizeStoryAssetName,
  type StoryAssetManifest,
} from "../models/story-assets.js";

describe("story asset contract helpers", () => {
  it("normalizes story asset kinds across Chinese and English aliases", () => {
    expect(normalizeStoryAssetKind("人物")).toBe("character");
    expect(normalizeStoryAssetKind("角色")).toBe("character");
    expect(normalizeStoryAssetKind("character")).toBe("character");
    expect(normalizeStoryAssetKind("场景")).toBe("scene");
    expect(normalizeStoryAssetKind("地点")).toBe("scene");
    expect(normalizeStoryAssetKind("scene")).toBe("scene");
    expect(normalizeStoryAssetKind("道具")).toBe("prop");
    expect(normalizeStoryAssetKind("物件")).toBe("prop");
    expect(normalizeStoryAssetKind("prop")).toBe("prop");
    expect(normalizeStoryAssetKind("")).toBeUndefined();
  });

  it("normalizes story asset names and rejects blank input", () => {
    expect(normalizeStoryAssetName("  主角  名称  ")).toBe("主角 名称");
    expect(() => normalizeStoryAssetName("   ")).toThrow(/empty/i);
  });

  it("creates an empty story asset manifest", () => {
    expect(createEmptyStoryAssetManifest("story-1", "2026-07-13T00:00:00.000Z")).toEqual({
      version: 1,
      storyId: "story-1",
      updatedAt: "2026-07-13T00:00:00.000Z",
      assets: [],
    });
  });

  it("merges assets by normalized kind and name while keeping ready images", () => {
    const existing: StoryAssetManifest = {
      version: 1,
      storyId: "story-1",
      updatedAt: "2026-07-13T00:00:00.000Z",
      assets: [
        {
          id: "character_a-ling",
          kind: "character",
          name: "阿玲",
          summary: "旧版摘要",
          details: { outfit: "蓝裙子" },
          imagePrompt: "旧图提示",
          sourceRefs: ["chapter-1"],
          image: {
            status: "ready",
            path: "assets/images/character_a-ling.png",
            generatedAt: "2026-07-13T00:00:00.000Z",
          },
          createdAt: "2026-07-13T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        },
      ],
    };

    const merged = mergeStoryAssets(
      existing,
      [
        {
          kind: "人物",
          name: "  阿玲  ",
          summary: "更新后的摘要",
          details: { outfit: "红裙子" },
          imagePrompt: "更新后的图提示",
          sourceRefs: ["chapter-3"],
        },
        {
          kind: "scene",
          name: "  雨夜小巷 ",
          summary: "新的场景",
          details: {},
          imagePrompt: "雨夜小巷，霓虹反光",
          sourceRefs: [],
        },
      ],
      "2026-07-13T01:00:00.000Z",
    );

    expect(merged).toEqual({
      version: 1,
      storyId: "story-1",
      updatedAt: "2026-07-13T01:00:00.000Z",
      assets: [
        {
          id: "character_a-ling",
          kind: "character",
          name: "阿玲",
          summary: "更新后的摘要",
          details: { outfit: "红裙子" },
          imagePrompt: "更新后的图提示",
          sourceRefs: ["chapter-3"],
          image: {
            status: "ready",
            path: "assets/images/character_a-ling.png",
            generatedAt: "2026-07-13T00:00:00.000Z",
          },
          createdAt: "2026-07-13T00:00:00.000Z",
          updatedAt: "2026-07-13T01:00:00.000Z",
        },
        {
          id: "scene_雨夜小巷",
          kind: "scene",
          name: "雨夜小巷",
          summary: "新的场景",
          details: {},
          imagePrompt: "雨夜小巷，霓虹反光",
          sourceRefs: [],
          image: {
            status: "missing",
          },
          createdAt: "2026-07-13T01:00:00.000Z",
          updatedAt: "2026-07-13T01:00:00.000Z",
        },
      ],
    });
  });

  it("deduplicates duplicate drafts across alias and spacing variants", () => {
    const merged = mergeStoryAssets(
      createEmptyStoryAssetManifest("story-dup", "2026-07-13T02:00:00.000Z"),
      [
        {
          kind: "人物",
          name: "  阿玲  ",
          summary: "第一版摘要",
          details: { outfit: "蓝裙子" },
          imagePrompt: "第一版提示",
          sourceRefs: ["chapter-1"],
        },
        {
          kind: "角色",
          name: "阿玲",
          summary: "第二版摘要",
          details: { outfit: "红裙子" },
          imagePrompt: "第二版提示",
          sourceRefs: ["chapter-2"],
        },
      ],
      "2026-07-13T03:00:00.000Z",
    );

    expect(merged.assets).toHaveLength(1);
    expect(merged.assets[0]).toMatchObject({
      kind: "character",
      name: "阿玲",
      summary: "第二版摘要",
      details: { outfit: "红裙子" },
      imagePrompt: "第二版提示",
      sourceRefs: ["chapter-2"],
      image: {
        status: "missing",
      },
    });
  });
});
