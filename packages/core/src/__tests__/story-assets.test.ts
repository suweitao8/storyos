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
import type { StoryAsset, StoryAssetImage } from "../index.js";
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
  generateMissingStoryAssetImages,
  generateStoryAssetImage,
  storyAssetManifestPath,
  type StoryAssetFileWriter,
  type StoryAssetImageRuntime,
  type StoryAssetManifestStore,
} from "../pipeline/story-assets-runner.js";

function makeStoryAssetImage(
  id: string,
  status: StoryAssetImage["status"],
  imagePrompt = `${id} prompt`,
): StoryAsset {
  return {
    id,
    kind: "character" as const,
    name: id,
    summary: `${id} summary`,
    details: {},
    imagePrompt,
    sourceRefs: [],
    image: { status },
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
  };
}

function makeImageManifest(
  storyId: string,
  assets: ReturnType<typeof makeStoryAssetImage>[],
): StoryAssetManifest {
  return {
    version: 1,
    storyId,
    updatedAt: "2026-07-13T00:00:00.000Z",
    assets,
  };
}

function makeImageDeps(manifest: StoryAssetManifest, runtime: StoryAssetImageRuntime) {
  let current = structuredClone(manifest);
  const writes: StoryAssetManifest[] = [];
  const manifestStore: StoryAssetManifestStore = {
    readManifest: vi.fn(async () => current),
    writeManifest: vi.fn(async (_path, next) => {
      current = structuredClone(next);
      writes.push(current);
    }),
  };
  const fileWriter: StoryAssetFileWriter = {
    writeFile: vi.fn(async () => undefined),
  };

  return {
    manifestStore,
    imageRuntime: runtime,
    fileWriter,
    clock: () => "2026-07-13T01:00:00.000Z",
    writes,
    getManifest: () => current,
  };
}

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
    expect(drafts[0]?.aliases).toHaveLength(1);
    expect(drafts[0]?.sourceRefs).toEqual(["settings", "content:chapter-1"]);
    expect(drafts[0]?.summary).toContain("雾港");
  });

  it("matches a renamed asset through a persisted alias and preserves its ready image", () => {
    const existing: StoryAssetManifest = {
      version: 1,
      storyId: "story-alias",
      updatedAt: "2026-07-13T00:00:00.000Z",
      assets: [
        {
          ...makeStoryAssetImage("hero", "ready"),
          name: "Hero",
          image: { status: "ready", path: "assets/images/hero.png" },
        },
      ],
    };

    const merged = mergeStoryAssets(existing, [{
      kind: "character",
      name: "The Hero",
      aliases: ["Hero"],
      summary: "Updated hero summary",
      imagePrompt: "Updated hero portrait",
    }], "2026-07-13T01:00:00.000Z");

    expect(merged.assets).toHaveLength(1);
    expect(merged.assets[0]).toMatchObject({
      id: "hero",
      name: "Hero",
      aliases: ["The Hero"],
      summary: "Updated hero summary",
      image: { status: "ready", path: "assets/images/hero.png" },
    });
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

describe("story asset image lifecycle", () => {
  it("persists generating before writing a ready image path", async () => {
    const manifest = makeImageManifest("story-image", [makeStoryAssetImage("character_1", "missing")]);
    const runtime: StoryAssetImageRuntime = {
      generateImage: vi.fn(async () => ({ buffer: Buffer.from("image"), extension: "png" })),
    };
    const deps = makeImageDeps(manifest, runtime);

    const result = await generateStoryAssetImage({
      storyId: "story-image",
      storyType: "book",
      assetId: "character_1",
      ...deps,
    });

    expect(deps.writes[0]?.assets[0]?.image).toEqual({ status: "generating" });
    expect(deps.fileWriter.writeFile).toHaveBeenCalledWith(
      "books/story-image/assets/images/character_1.png",
      Buffer.from("image"),
    );
    expect(result).toMatchObject({
      assetId: "character_1",
      status: "ready",
      path: "books/story-image/assets/images/character_1.png",
    });
    expect(deps.getManifest().assets[0]?.image).toEqual({
      status: "ready",
      path: "books/story-image/assets/images/character_1.png",
      generatedAt: "2026-07-13T01:00:00.000Z",
    });
  });

  it("skips ready assets while returning a result for every batch asset", async () => {
    const manifest = makeImageManifest("story-batch", [
      { ...makeStoryAssetImage("ready_asset", "ready"), image: { status: "ready", path: "assets/images/ready_asset.png" } },
      makeStoryAssetImage("missing_asset", "missing"),
    ]);
    const runtime: StoryAssetImageRuntime = {
      generateImage: vi.fn(async () => ({ buffer: Buffer.from("image"), extension: "jpg" })),
    };
    const deps = makeImageDeps(manifest, runtime);

    const results = await generateMissingStoryAssetImages({
      storyId: "story-batch",
      storyType: "short",
      ...deps,
    });

    expect(runtime.generateImage).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      {
        assetId: "ready_asset",
        status: "skipped",
        path: "assets/images/ready_asset.png",
      },
      expect.objectContaining({ assetId: "missing_asset", status: "ready" }),
    ]);
  });

  it("continues batch generation after one asset fails", async () => {
    const manifest = makeImageManifest("story-partial", [
      makeStoryAssetImage("first_asset", "missing"),
      makeStoryAssetImage("second_asset", "missing"),
    ]);
    const runtime: StoryAssetImageRuntime = {
      generateImage: vi.fn()
        .mockRejectedValueOnce(new Error("first asset failed"))
        .mockResolvedValueOnce({ buffer: Buffer.from("second image"), extension: "png" }),
    };
    const deps = makeImageDeps(manifest, runtime);

    const results = await generateMissingStoryAssetImages({
      storyId: "story-partial",
      storyType: "short",
      ...deps,
    });

    expect(results).toEqual([
      { assetId: "first_asset", status: "error", error: "first asset failed" },
      {
        assetId: "second_asset",
        status: "ready",
        path: "shorts/story-partial/assets/images/second_asset.png",
      },
    ]);
    expect(deps.fileWriter.writeFile).toHaveBeenCalledTimes(1);
  });

  it("continues batch generation after an asset returns an unsafe extension", async () => {
    const manifest = makeImageManifest("story-unsafe-extension", [
      makeStoryAssetImage("first_asset", "missing"),
      makeStoryAssetImage("second_asset", "missing"),
    ]);
    const originalManifest = structuredClone(manifest);
    const runtime: StoryAssetImageRuntime = {
      generateImage: vi.fn()
        .mockResolvedValueOnce({ buffer: Buffer.from("unsafe image"), extension: "svg" })
        .mockResolvedValueOnce({ buffer: Buffer.from("second image"), extension: "png" }),
    };
    const deps = makeImageDeps(manifest, runtime);

    const results = await generateMissingStoryAssetImages({
      storyId: "story-unsafe-extension",
      storyType: "short",
      ...deps,
    });

    expect(results).toEqual([
      {
        assetId: "first_asset",
        status: "error",
        error: expect.stringMatching(/unsafe story asset image extension/i),
      },
      {
        assetId: "second_asset",
        status: "ready",
        path: "shorts/story-unsafe-extension/assets/images/second_asset.png",
      },
    ]);
    expect(runtime.generateImage).toHaveBeenCalledTimes(2);
    expect(deps.fileWriter.writeFile).toHaveBeenCalledTimes(1);
    expect(manifest).toEqual(originalManifest);
  });

  it("keeps single-image unsafe extension errors explicit", async () => {
    const manifest = makeImageManifest("story-single-unsafe-extension", [makeStoryAssetImage("asset_1", "missing")]);
    const runtime: StoryAssetImageRuntime = {
      generateImage: vi.fn(async () => ({ buffer: Buffer.from("unsafe image"), extension: "svg" })),
    };
    const deps = makeImageDeps(manifest, runtime);

    await expect(generateStoryAssetImage({
      storyId: "story-single-unsafe-extension",
      storyType: "short",
      assetId: "asset_1",
      ...deps,
    })).rejects.toThrow('Unsafe story asset image extension: "svg"');
    expect(deps.getManifest().assets[0]?.image).toEqual({
      status: "error",
      error: 'Unsafe story asset image extension: "svg"',
    });
  });

  it("does not invoke text extraction while generating image assets", async () => {
    const manifest = makeImageManifest("story-image-only", [makeStoryAssetImage("asset_1", "missing")]);
    const runtime: StoryAssetImageRuntime = {
      generateImage: vi.fn(async () => ({ buffer: Buffer.from("image"), extension: "png" })),
    };
    const deps = makeImageDeps(manifest, runtime);
    const extractSpy = vi.spyOn(StoryAssetExtractorAgent.prototype, "extract");

    await generateMissingStoryAssetImages({
      storyId: "story-image-only",
      storyType: "short",
      ...deps,
    });

    expect(runtime.generateImage).toHaveBeenCalledWith("asset_1 prompt");
    expect(extractSpy).not.toHaveBeenCalled();
    extractSpy.mockRestore();
  });

  it("persists an image error without losing the image prompt", async () => {
    const manifest = makeImageManifest("story-error", [makeStoryAssetImage("scene_1", "missing", "keep this prompt")]);
    const runtime: StoryAssetImageRuntime = {
      generateImage: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    };
    const deps = makeImageDeps(manifest, runtime);

    const result = await generateStoryAssetImage({
      storyId: "story-error",
      storyType: "short",
      assetId: "scene_1",
      ...deps,
    });

    expect(result).toEqual({ assetId: "scene_1", status: "error", error: "provider unavailable" });
    expect(deps.getManifest().assets[0]).toMatchObject({
      imagePrompt: "keep this prompt",
      image: { status: "error", error: "provider unavailable" },
    });
    expect(deps.fileWriter.writeFile).not.toHaveBeenCalled();
  });

  it("retries an error asset and persists the next successful image", async () => {
    const manifest = makeImageManifest("story-retry", [makeStoryAssetImage("prop_1", "error", "retry prompt")]);
    const runtime: StoryAssetImageRuntime = {
      generateImage: vi.fn()
        .mockRejectedValueOnce(new Error("temporary failure"))
        .mockResolvedValueOnce({ buffer: Buffer.from("retry image"), extension: "png" }),
    };
    const deps = makeImageDeps(manifest, runtime);

    const first = await generateStoryAssetImage({
      storyId: "story-retry",
      storyType: "short",
      assetId: "prop_1",
      ...deps,
    });
    const second = await generateStoryAssetImage({
      storyId: "story-retry",
      storyType: "short",
      assetId: "prop_1",
      ...deps,
    });

    expect(first).toMatchObject({ status: "error", error: "temporary failure" });
    expect(second).toMatchObject({
      assetId: "prop_1",
      status: "ready",
      path: "shorts/story-retry/assets/images/prop_1.png",
    });
    expect(runtime.generateImage).toHaveBeenCalledTimes(2);
    expect(deps.getManifest().assets[0]?.image.status).toBe("ready");
    expect(deps.getManifest().assets[0]?.imagePrompt).toBe("retry prompt");
  });

  it("rejects asset ids that could escape the story image directory", async () => {
    const manifest = makeImageManifest("story-safe", [makeStoryAssetImage("safe", "missing")]);
    const runtime: StoryAssetImageRuntime = {
      generateImage: vi.fn(async () => ({ buffer: Buffer.from("image"), extension: "png" })),
    };
    const deps = makeImageDeps(manifest, runtime);

    await expect(generateStoryAssetImage({
      storyId: "story-safe",
      storyType: "short",
      assetId: "../outside",
      ...deps,
    })).rejects.toThrow(/unsafe|invalid/i);
    expect(runtime.generateImage).not.toHaveBeenCalled();
    expect(deps.fileWriter.writeFile).not.toHaveBeenCalled();
  });
});
