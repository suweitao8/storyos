import { describe, expect, it } from "vitest";
import {
  createEmptyStoryAssetManifest,
  mergeStoryAssets,
  normalizeStoryAssetKind,
  normalizeStoryAssetName,
  normalizeStoryAssetImageStatus,
  type StoryAssetManifest,
} from "../models/story-assets.js";
import { createEmptyStoryAssetManifest as createEmptyStoryAssetManifestFromRoot } from "../index.js";
import { normalizeStoryAssetImageStatus as normalizeStoryAssetImageStatusFromRoot } from "../index.js";
import type { StoryAssetImage } from "../index.js";

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
    expect(normalizeStoryAssetKind("constructor")).toBeUndefined();
    expect(normalizeStoryAssetKind("__proto__")).toBeUndefined();
  });

  it("normalizes image status values", () => {
    expect(normalizeStoryAssetImageStatus("ready")).toBe("ready");
    expect(normalizeStoryAssetImageStatus("  generating ")).toBe("generating");
    expect(normalizeStoryAssetImageStatus("bad")).toBeUndefined();
    expect(normalizeStoryAssetImageStatusFromRoot("error")).toBe("error");
  });

  it("normalizes story asset names and rejects blank input", () => {
    expect(normalizeStoryAssetName("  主角  名称  ")).toBe("主角 名称");
    expect(() => normalizeStoryAssetName("   ")).toThrow(/empty/i);
  });

  it("creates an empty story asset manifest from both model and root entry", () => {
    const direct = createEmptyStoryAssetManifest("story-1", "2026-07-13T00:00:00.000Z");
    const fromRoot = createEmptyStoryAssetManifestFromRoot("story-1", "2026-07-13T00:00:00.000Z");

    expect(direct).toEqual(fromRoot);
    expect(fromRoot).toEqual({
      version: 1,
      storyId: "story-1",
      updatedAt: "2026-07-13T00:00:00.000Z",
      assets: [],
    });
  });

  it("rejects invalid manifest metadata instead of returning illegal manifests", () => {
    expect(() => createEmptyStoryAssetManifest("", "2026-07-13T00:00:00.000Z")).toThrow(/storyId/i);
    expect(() => createEmptyStoryAssetManifest("story-1", "   ")).toThrow(/updatedAt/i);
    expect(() => mergeStoryAssets({ version: 1, storyId: "story-1", updatedAt: "2026-07-13T00:00:00.000Z", assets: [] }, [], null as unknown as string)).toThrow(/updatedAt/i);
    expect(() => mergeStoryAssets({ version: 1, storyId: "story-1", updatedAt: "2026-07-13T00:00:00.000Z", assets: [] }, [], 123 as unknown as string)).toThrow(/updatedAt/i);
    expect(() =>
      mergeStoryAssets(
        { version: 1, storyId: "", updatedAt: "2026-07-13T00:00:00.000Z", assets: [] },
        [],
      ),
    ).toThrow(/story asset manifest storyId/i);
    expect(() =>
      mergeStoryAssets(
        { version: 1, storyId: "story-1", updatedAt: "", assets: [] },
        [],
      ),
    ).toThrow(/story asset manifest updatedAt/i);
  });

  it("merges assets while preserving omitted details/source refs and ready image state", () => {
    const existing: StoryAssetManifest = {
      version: 1,
      storyId: "story-1",
      updatedAt: "2026-07-13T00:00:00.000Z",
      assets: [
        {
          id: "character_old",
          kind: "character",
          name: "阿玲",
          summary: "旧版摘要",
          details: { outfit: "蓝裙子" },
          imagePrompt: "旧图提示",
          sourceRefs: ["chapter-1"],
          image: {
            status: "ready",
            path: "assets/images/character_old.png",
            generatedAt: "2026-07-13T00:00:00.000Z",
          },
          createdAt: "2026-07-13T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        },
      ],
    };

    const draft = {
      kind: "人物",
      name: "  阿玲  ",
      summary: "更新后的摘要",
      imagePrompt: "更新后的图提示",
    };

    const merged = mergeStoryAssets(existing, [draft], "2026-07-13T01:00:00.000Z");

    expect(merged.assets).toHaveLength(1);
    expect(merged.assets[0]).toMatchObject({
      id: "character_old",
      kind: "character",
      name: "阿玲",
      summary: "更新后的摘要",
      details: { outfit: "蓝裙子" },
      imagePrompt: "更新后的图提示",
      sourceRefs: ["chapter-1"],
      image: {
        status: "ready",
        path: "assets/images/character_old.png",
        generatedAt: "2026-07-13T00:00:00.000Z",
      },
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T01:00:00.000Z",
    });
  });

  it("treats null draft fields as missing and preserves existing values consistently", () => {
    const existing: StoryAssetManifest = {
      version: 1,
      storyId: "story-null",
      updatedAt: "2026-07-13T00:00:00.000Z",
      assets: [
        {
          id: "scene_old",
          kind: "scene",
          name: "大厅",
          summary: "旧摘要",
          details: { mood: "calm" },
          imagePrompt: "旧提示",
          sourceRefs: ["chapter-1"],
          image: { status: "error", error: "boom" },
          createdAt: "2026-07-13T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        },
      ],
    };

    const merged = mergeStoryAssets(
      existing,
      [
        {
          kind: "场景",
          name: "大厅",
          summary: null,
          imagePrompt: null,
          details: null,
          sourceRefs: null,
        },
      ],
      "2026-07-13T01:00:00.000Z",
    );

    expect(merged.assets[0]).toMatchObject({
      summary: "旧摘要",
      details: { mood: "calm" },
      imagePrompt: "旧提示",
      sourceRefs: ["chapter-1"],
      image: { status: "error", error: "boom" },
    });
  });

  it("ignores illegal draft field types instead of blanking existing values", () => {
    const existing: StoryAssetManifest = {
      version: 1,
      storyId: "story-illegal",
      updatedAt: "2026-07-13T00:00:00.000Z",
      assets: [
        {
          id: "character_keep",
          kind: "character",
          name: "阿玲",
          summary: "旧摘要",
          details: { outfit: "蓝裙子" },
          imagePrompt: "旧提示",
          sourceRefs: ["chapter-1"],
          image: { status: "ready", path: "assets/images/character_keep.png" },
          createdAt: "2026-07-13T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        },
      ],
    };

    const merged = mergeStoryAssets(
      existing,
      [
        {
          kind: "角色",
          name: "阿玲",
          summary: 123,
          imagePrompt: { prompt: "bad" },
          details: 42,
          sourceRefs: { refs: ["bad"] },
        },
      ],
      "2026-07-13T01:00:00.000Z",
    );

    expect(merged.assets[0]).toMatchObject({
      summary: "旧摘要",
      details: { outfit: "蓝裙子" },
      imagePrompt: "旧提示",
      sourceRefs: ["chapter-1"],
      image: { status: "ready", path: "assets/images/character_keep.png" },
    });
  });

  it("clears details and source refs when the draft explicitly provides empty values", () => {
    const existing: StoryAssetManifest = {
      version: 1,
      storyId: "story-2",
      updatedAt: "2026-07-13T00:00:00.000Z",
      assets: [
        {
          id: "prop_old",
          kind: "prop",
          name: "信件",
          summary: "旧摘要",
          details: { owner: "A" },
          imagePrompt: "旧提示",
          sourceRefs: ["chapter-1"],
          image: { status: "generating" },
          createdAt: "2026-07-13T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        },
      ],
    };

    const merged = mergeStoryAssets(
      existing,
      [
        {
          kind: "道具",
          name: "信件",
          summary: "新摘要",
          details: {},
          sourceRefs: [],
          imagePrompt: "新提示",
        },
      ],
      "2026-07-13T01:00:00.000Z",
    );

    expect(merged.assets[0]).toMatchObject({
      details: {},
      sourceRefs: [],
      image: { status: "generating" },
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
      image: { status: "missing" },
    });
  });

  it("keeps distinct ids for names that only differ by path separators", () => {
    const manifestWithDuplicateIds: StoryAssetManifest = {
      version: 1,
      storyId: "story-ids",
      updatedAt: "2026-07-13T02:00:00.000Z",
      assets: [
        {
          id: "duplicate-id",
          kind: "prop",
          name: "甲",
          summary: "",
          details: {},
          imagePrompt: "",
          sourceRefs: [],
          image: { status: "missing" },
          createdAt: "2026-07-13T02:00:00.000Z",
          updatedAt: "2026-07-13T02:00:00.000Z",
        },
        {
          id: "duplicate-id",
          kind: "scene",
          name: "乙",
          summary: "",
          details: {},
          imagePrompt: "",
          sourceRefs: [],
          image: { status: "generating" },
          createdAt: "2026-07-13T02:00:00.000Z",
          updatedAt: "2026-07-13T02:00:00.000Z",
        },
      ],
    };

    const merged = mergeStoryAssets(
      manifestWithDuplicateIds,
      [
        { kind: "prop", name: "a/b", summary: "", details: {}, imagePrompt: "", sourceRefs: [] },
        { kind: "prop", name: "a\\b", summary: "", details: {}, imagePrompt: "", sourceRefs: [] },
      ],
      "2026-07-13T03:00:00.000Z",
    );

    expect(merged.assets).toHaveLength(4);
    expect(new Set(merged.assets.map((asset) => asset.id)).size).toBe(4);
    expect(merged.assets.find((asset) => asset.kind === "prop" && asset.name === "a/b")?.id).not.toBe(
      merged.assets.find((asset) => asset.kind === "prop" && asset.name === "a\\b")?.id,
    );
    expect(
      merged.assets.filter((asset) => asset.id === "duplicate-id"),
    ).toHaveLength(1);
    expect(
      mergeStoryAssets(manifestWithDuplicateIds, [], "2026-07-13T03:00:00.000Z").assets.map((asset) => asset.id),
    ).toEqual(merged.assets.slice(0, 2).map((asset) => asset.id));
  });

  it("renames generated ids when they collide with existing explicit ids", () => {
    const generatedId = mergeStoryAssets(
      createEmptyStoryAssetManifest("story-generate", "2026-07-13T02:00:00.000Z"),
      [{ kind: "prop", name: "a/b", summary: "", details: {}, imagePrompt: "", sourceRefs: [] }],
      "2026-07-13T03:00:00.000Z",
    ).assets[0].id;

    const merged = mergeStoryAssets(
      {
        version: 1,
        storyId: "story-collision",
        updatedAt: "2026-07-13T02:00:00.000Z",
        assets: [
          {
            id: generatedId,
            kind: "scene",
            name: "占位",
            summary: "",
            details: {},
            imagePrompt: "",
            sourceRefs: [],
            image: { status: "missing" },
            createdAt: "2026-07-13T02:00:00.000Z",
            updatedAt: "2026-07-13T02:00:00.000Z",
          },
        ],
      },
      [{ kind: "prop", name: "a/b", summary: "", details: {}, imagePrompt: "", sourceRefs: [] }],
      "2026-07-13T03:00:00.000Z",
    );

    expect(merged.assets).toHaveLength(2);
    expect(new Set(merged.assets.map((asset) => asset.id)).size).toBe(2);
    expect(merged.assets[1].id).not.toBe(generatedId);
  });

  it("drops malformed external JSON inputs without TypeError and keeps inputs immutable", () => {
    const manifest = {
      version: 1,
      storyId: "story-safe",
      updatedAt: "2026-07-13T00:00:00.000Z",
      assets: [
        null,
        {
          id: "bad",
          kind: "character",
          name: "坏输入",
        },
        {
          id: "good",
          kind: "scene",
          name: "大厅",
          summary: "原始摘要",
          details: { mood: "calm" },
          imagePrompt: "大厅",
          sourceRefs: ["chapter-1"],
          image: { status: "error", error: "boom" },
          createdAt: "2026-07-13T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        },
      ],
    } as const;

    const draft = {
      kind: "场景",
      name: "大厅",
      summary: "更新摘要",
      imagePrompt: "更新提示",
    } as const;

    const manifestBefore = structuredClone(manifest);
    const draftBefore = structuredClone(draft);

    const merged = mergeStoryAssets(manifest, [null, draft], "2026-07-13T01:00:00.000Z");

    expect(merged.assets).toHaveLength(1);
    expect(merged.assets[0]).toMatchObject({
      id: "good",
      kind: "scene",
      name: "大厅",
      summary: "更新摘要",
      details: { mood: "calm" },
      imagePrompt: "更新提示",
      sourceRefs: ["chapter-1"],
      image: { status: "error", error: "boom" },
    });
    expect(manifest).toEqual(manifestBefore);
    expect(draft).toEqual(draftBefore);
  });

  it("exports public helpers and types from the root entry", () => {
    const image: StoryAssetImage = { status: "missing" };

    expect(image.status).toBe("missing");
    expect(createEmptyStoryAssetManifestFromRoot("story-root").version).toBe(1);
    expect(normalizeStoryAssetImageStatusFromRoot("ready")).toBe("ready");
  });
});
