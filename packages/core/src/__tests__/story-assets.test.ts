import { describe, expect, it, vi } from "vitest";
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
import {
  StoryAssetExtractorAgent as StoryAssetExtractorAgentFromRoot,
  buildStoryAssetExtractionPrompt as buildStoryAssetExtractionPromptFromRoot,
  extractStoryAssets as extractStoryAssetsFromRoot,
} from "../index.js";
import {
  StoryAssetExtractorAgent,
  buildStoryAssetExtractionPrompt,
  parseStoryAssetExtractionResponse,
} from "../agents/story-assets.js";
import {
  extractStoryAssets,
  storyAssetManifestPath,
  type StoryAssetManifestStore,
} from "../pipeline/story-assets-runner.js";

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

  it("allows explicit empty strings to clear summary and imagePrompt", () => {
    const existing: StoryAssetManifest = {
      version: 1,
      storyId: "story-clear",
      updatedAt: "2026-07-13T00:00:00.000Z",
      assets: [
        {
          id: "scene_clear",
          kind: "scene",
          name: "Grand Hall",
          summary: "Old summary",
          details: { mood: "calm" },
          imagePrompt: "Old image prompt",
          sourceRefs: ["chapter-1"],
          image: { status: "ready", path: "assets/images/scene_clear.png" },
          createdAt: "2026-07-13T00:00:00.000Z",
          updatedAt: "2026-07-13T00:00:00.000Z",
        },
      ],
    };

    const merged = mergeStoryAssets(
      existing,
      [
        {
          kind: "scene",
          name: "Grand Hall",
          summary: "",
          imagePrompt: "",
        },
      ],
      "2026-07-13T01:00:00.000Z",
    );

    expect(merged.assets[0]).toMatchObject({
      summary: "",
      imagePrompt: "",
      details: { mood: "calm" },
      sourceRefs: ["chapter-1"],
    });
  });

  it("keeps existing text when a draft only contains whitespace", () => {
    const existing = createEmptyStoryAssetManifest("story-whitespace", "2026-07-13T00:00:00.000Z");
    const seeded = mergeStoryAssets(
      existing,
      [{ kind: "scene", name: "Hall", summary: "Existing", imagePrompt: "Existing prompt" }],
      "2026-07-13T00:30:00.000Z",
    );

    const merged = mergeStoryAssets(
      seeded,
      [{ kind: "scene", name: "Hall", summary: "   ", imagePrompt: "\t" }],
      "2026-07-13T01:00:00.000Z",
    );

    expect(merged.assets[0]).toMatchObject({
      summary: "Existing",
      imagePrompt: "Existing prompt",
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

describe("story asset text extraction", () => {
  it("includes settings, outline, and story content in the extraction prompt", () => {
    const prompt = buildStoryAssetExtractionPrompt({
      settings: "设定：雾港城禁止夜间点灯。",
      outline: "大纲：阿玲在旧码头寻找账本。",
      content: "正文：她把银色怀表放在潮湿的木箱上。",
    });

    expect(prompt).toContain("设定：雾港城禁止夜间点灯。");
    expect(prompt).toContain("大纲：阿玲在旧码头寻找账本。");
    expect(prompt).toContain("正文：她把银色怀表放在潮湿的木箱上。");
    expect(prompt).toContain("JSON");
  });

  it("parses a fenced JSON response with Chinese and English kind aliases", () => {
    const drafts = parseStoryAssetExtractionResponse("```json\n" + `
{
  "characters": [{ "kind": "人物", "name": "阿玲", "summary": "守夜人", "imagePrompt": "cinematic portrait" }],
  "scenes": [{ "kind": "location", "name": "旧码头", "summary": "潮湿码头", "imagePrompt": "misty harbor" }],
  "props": [{ "kind": "道具", "name": "银色怀表", "summary": "停在午夜的怀表", "imagePrompt": "silver pocket watch" }]
}
` + "```\n");

    expect(drafts).toHaveLength(3);
    expect(drafts.map((draft) => draft.kind)).toEqual(["character", "scene", "prop"]);
    expect(drafts.every((draft) => typeof draft.summary === "string" && draft.summary.length > 0)).toBe(true);
    expect(drafts.every((draft) => typeof draft.imagePrompt === "string" && draft.imagePrompt.length > 0)).toBe(true);
  });

  it("throws a clear error for invalid JSON instead of fabricating assets", () => {
    expect(() => parseStoryAssetExtractionResponse("not json")).toThrow(/story asset.*json|json.*story asset/i);
  });

  it("coalesces duplicate names and aliases into one draft", () => {
    const drafts = parseStoryAssetExtractionResponse(JSON.stringify({
      characters: [
        {
          kind: "character",
          name: "Mara",
          aliases: ["林默"],
          summary: "冷静的调查员",
          sourceRefs: ["settings"],
          imagePrompt: "realistic investigator portrait",
        },
        {
          kind: "人物",
          name: "林默",
          summary: "在雾港追查旧案",
          sourceRefs: ["content:chapter-1"],
          imagePrompt: "dark coat and harbor fog",
        },
      ],
      scenes: [],
      props: [],
    }));

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ kind: "character", name: "Mara" });
    expect(drafts[0]?.sourceRefs).toEqual(["settings", "content:chapter-1"]);
    expect(drafts[0]?.summary).toContain("雾港");
  });

  it("returns an empty draft list when the model returns no assets", () => {
    expect(parseStoryAssetExtractionResponse('{ "characters": [], "scenes": [], "props": [] }')).toEqual([]);
  });

  it("uses only the injected text model and never invokes image generation", async () => {
    const imageRuntime = vi.fn();
    const textModel = vi.fn(async () => JSON.stringify({
      characters: [{ kind: "character", name: "阿玲", summary: "守夜人", imagePrompt: "portrait" }],
      scenes: [],
      props: [],
    }));
    const store: StoryAssetManifestStore = {
      readManifest: vi.fn(async () => undefined),
      writeManifest: vi.fn(async () => undefined),
    };

    const result = await extractStoryAssets({
      storyId: "story-text-only",
      storyType: "short",
      settings: "设定",
      outline: "大纲",
      content: "正文",
      textModel,
      manifestStore: store,
    });

    expect(textModel).toHaveBeenCalledTimes(1);
    expect(imageRuntime).not.toHaveBeenCalled();
    expect(result.manifest.assets[0]?.image).toEqual({ status: "missing" });
    expect(store.writeManifest).toHaveBeenCalledWith(
      "shorts/story-text-only/assets/manifest.json",
      result.manifest,
    );
  });

  it.each([
    ["book", "books/long-story/assets/manifest.json"],
    ["short", "shorts/short-story/assets/manifest.json"],
  ] as const)("writes the manifest to the %s story path", async (storyType, expectedPath) => {
    const store: StoryAssetManifestStore = {
      readManifest: vi.fn(async () => undefined),
      writeManifest: vi.fn(async () => undefined),
    };

    await extractStoryAssets({
      storyId: storyType === "book" ? "long-story" : "short-story",
      storyType,
      settings: "",
      outline: "",
      content: "",
      textModel: async () => '{ "characters": [], "scenes": [], "props": [] }',
      manifestStore: store,
    });

    expect(storyAssetManifestPath(storyType, storyType === "book" ? "long-story" : "short-story")).toBe(expectedPath);
    expect(store.writeManifest).toHaveBeenCalledWith(expectedPath, expect.any(Object));
  });

  it("exports the extraction API from the core root entry", () => {
    expect(StoryAssetExtractorAgentFromRoot).toBe(StoryAssetExtractorAgent);
    expect(buildStoryAssetExtractionPromptFromRoot).toBe(buildStoryAssetExtractionPrompt);
    expect(extractStoryAssetsFromRoot).toBe(extractStoryAssets);
  });
});
