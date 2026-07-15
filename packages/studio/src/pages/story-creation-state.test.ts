import { describe, expect, it, vi } from "vitest";
import {
  buildDefaultStoryDirection,
  buildStoryWordCountOptions,
  formatStoryWordCount,
  buildLongStoryCreationAction,
  buildShortStoryCreationAction,
  filterCraftOptionsForStoryKind,
  resolveDefaultCreationCraftId,
  LONG_STORY_CHAPTERS,
  SHORT_STORY_CHAPTERS,
  STORY_WORD_COUNT_OPTIONS,
  normalizeStoryWordCount,
  resolveDefaultStoryWordCount,
  resolveStorySeedGenerationStatus,
  isStorySeedReadyForCreation,
  shouldAutoGenerateShortStorySeed,
} from "./story-creation-state";
import {
  parseStorySeedStreamEvent,
  queueStorySeedGeneration,
  streamStorySeed,
} from "./story-seed-stream";

describe("story creation actions", () => {
  it("limits short-story creation to Bilibili short-story craft modes", () => {
    const crafts = [
      { id: "novel", sourceName: "小说模式", mode: "general" as const, sourceType: "novel" as const },
      { id: "film", sourceName: "影视解说", mode: "bilibili-commentary" as const, sourceType: "bilibili" as const },
      { id: "short", sourceName: "短篇参考", mode: "bilibili-short-story" as const, sourceType: "bilibili" as const },
    ];

    expect(filterCraftOptionsForStoryKind("short", crafts).map((craft) => craft.id)).toEqual(["short"]);
    expect(resolveDefaultCreationCraftId(filterCraftOptionsForStoryKind("short", crafts), "novel")).toBe("short");
  });

  it("uses legacy review crafts as film-commentary references", () => {
    const crafts = [
      { id: "short", sourceName: "短篇参考", mode: "bilibili-short-story" as const, sourceType: "bilibili" as const },
      { id: "film", sourceName: "影视解说", mode: "bilibili-commentary" as const, sourceType: "bilibili" as const },
      { id: "review", sourceName: "评论调侃", mode: "bilibili-review" as const, sourceType: "bilibili" as const },
    ];

    expect(filterCraftOptionsForStoryKind("short", crafts, "bilibili-commentary").map((craft) => craft.id)).toEqual(["film", "review"]);
  });

  it("never automatically generates a short-story seed", () => {
    expect(shouldAutoGenerateShortStorySeed({
      title: "缓存故事",
      genreTone: "悬疑",
      hook: "钩子",
      worldview: "世界观",
      characters: "角色",
      conflict: "冲突",
      outline: "大纲",
      reversals: "反转",
      ending: "结局",
      visualAudioMotifs: "母题",
    })).toBe(false);
    expect(shouldAutoGenerateShortStorySeed()).toBe(false);
  });

  it("reflects the persisted background story-seed state", () => {
    expect(resolveStorySeedGenerationStatus({ id: "ready", sourceName: "ready", storySeed: {
      title: "标题", genreTone: "类型", hook: "钩子", worldview: "世界", characters: "角色",
      conflict: "冲突", outline: "大纲", reversals: "反转", ending: "结局", visualAudioMotifs: "母题",
    } })).toBe("ready");
    expect(resolveStorySeedGenerationStatus({ id: "pending", sourceName: "pending", storySeedStatus: "pending" })).toBe("generating");
    expect(resolveStorySeedGenerationStatus({ id: "replacing", sourceName: "replacing", storySeedStatus: "pending", storySeed: {
      title: "旧设定", genreTone: "类型", hook: "钩子", worldview: "世界", characters: "角色",
      conflict: "冲突", outline: "大纲", reversals: "反转", ending: "结局", visualAudioMotifs: "母题",
    } })).toBe("generating");
    expect(resolveStorySeedGenerationStatus({ id: "error", sourceName: "error", storySeedStatus: "error" })).toBe("error");
    expect(resolveStorySeedGenerationStatus({ id: "idle", sourceName: "idle" })).toBe("idle");
  });

  it("allows creation after the story seed is ready while its background score continues", () => {
    const failedSeed = {
      id: "failed",
      sourceName: "failed",
      storySeedStatus: "error" as const,
      storySeed: {
        title: "旧设定", genreTone: "现实悬疑", hook: "钩子", worldview: "现实场景", characters: "角色",
        conflict: "冲突", outline: "大纲", reversals: "反转", ending: "结局", visualAudioMotifs: "氛围",
      },
    };

    expect(isStorySeedReadyForCreation(failedSeed)).toBe(false);
    expect(isStorySeedReadyForCreation({ ...failedSeed, storySeedStatus: "ready" })).toBe(true);
    expect(isStorySeedReadyForCreation({
      ...failedSeed,
      storySeedStatus: "ready",
      storySeedScoreStatus: "pending",
    })).toBe(true);
    expect(isStorySeedReadyForCreation({
      ...failedSeed,
      storySeedStatus: "ready",
      storySeedScoreStatus: "error",
    })).toBe(true);
  });

  it("uses the cached story seed as the default direction", () => {
    const direction = buildDefaultStoryDirection({
      id: "seeded",
      sourceName: "有默认设定的模式",
      mode: "ghost-story",
      storySeed: {
        title: "午夜的门",
        genreTone: "都市灵异",
        hook: "第二次敲门来自不存在的住户。",
        worldview: "整栋楼会删除住户的痕迹。",
        characters: "夜班维修员和被抹去的一家人。",
        conflict: "回应敲门就会失去一段记忆。",
        outline: "调查门牌、追查住户、面对敲门者。",
        reversals: "主角曾经主动参与过删除。",
        ending: "救回住户，却失去自己的名字。",
        visualAudioMotifs: "坏钟、敲门声、忽明忽暗的灯。",
        originalizationPlan: "把住宅改造成写字楼，重建身份、关系和因果链。",
      },
    }, "short", true);

    // The serialized seed is the full direction — no extra originality instruction
    expect(direction).toContain("午夜的门");
    expect(direction).toContain("整栋楼会删除住户的痕迹");
    // Legacy optional fields are still serialized if present
    expect(direction).toContain("原创要点");
    expect(direction).toContain("把住宅改造成写字楼");
  });

  it("returns the serialized seed without extra instructions for legacy seeds", () => {
    const direction = buildDefaultStoryDirection({
      id: "legacy-seed",
      sourceName: "旧模式",
      mode: "bilibili-short-story",
      storySeed: {
        title: "旧故事设定",
        genreTone: "悬疑",
        hook: "旧钩子",
        worldview: "旧世界规则",
        characters: "旧角色关系",
        conflict: "旧冲突",
        outline: "旧事件顺序",
        reversals: "旧反转",
        ending: "旧结局",
        visualAudioMotifs: "旧母题",
      },
    }, "short", true);

    expect(direction).toContain("旧故事设定");
    expect(direction).toContain("旧世界规则");
    // No originality instruction is appended anymore
    expect(direction).not.toContain("当前模式没有缓存的原创化改编方案");
  });

  it("builds an editable original direction for the selected craft", () => {
    const direction = buildDefaultStoryDirection({ id: "ghost", sourceName: "reference", mode: "ghost-story" }, "short", true);

    expect(direction).toContain("完全原创");
    expect(direction).toContain("不得复制参考作品");
    expect(direction).toContain("第二次敲门");
  });

  it("exposes the supported per-chapter word-count settings", () => {
    expect(STORY_WORD_COUNT_OPTIONS).toEqual([5_000, 10_000, 15_000, 20_000, 25_000, 30_000]);
  });

  it("adds the selected craft recommendation without removing fixed choices", () => {
    expect(buildStoryWordCountOptions(42_900)).toEqual([5_000, 10_000, 15_000, 20_000, 25_000, 30_000, 45_000]);
    expect(resolveDefaultStoryWordCount(42_900)).toBe(45_000);
    expect(resolveDefaultStoryWordCount()).toBe(10_000);
  });

  it("rounds every mode recommendation to a 5000-character step", () => {
    expect(normalizeStoryWordCount(22_000)).toBe(20_000);
    expect(normalizeStoryWordCount(22_600)).toBe(25_000);
    expect(normalizeStoryWordCount(1_000)).toBe(5_000);
  });

  it("formats chapter word counts as approximate Chinese units", () => {
    expect(formatStoryWordCount(5_000, "zh")).toBe("5,000字");
    expect(formatStoryWordCount(10_000, "zh")).toBe("1万字");
    expect(formatStoryWordCount(15_000, "zh")).toBe("15,000字");
    expect(formatStoryWordCount(20_000, "zh")).toBe("2万字");
    expect(formatStoryWordCount(22_000, "en")).toBe("22,000 words");
  });

  it("binds the selected craft to long-form book creation", () => {
    const action = buildLongStoryCreationAction({
      title: "夜港账本",
      genre: "悬疑",
      direction: "一名巡夜人发现港口的失踪记录会提前一天出现",
      language: "zh",
      chapterWordCount: 10_000,
      craftId: "craft-ghost",
    });

    expect(action.requestedIntent).toBe("create_book");
    expect(action.actionPayload.createBook?.craftId).toBe("craft-ghost");
    expect(action.actionPayload.createBook?.targetChapters).toBe(LONG_STORY_CHAPTERS);
    expect(action.actionPayload.createBook?.platform).toBe("qidian");
    expect(action.actionPayload.createBook?.chapterWordCount).toBe(10_000);
    expect(action.actionPayload.createBook?.quick).toBe(true);
    expect(LONG_STORY_CHAPTERS * 10_000).toBe(100_000);
    expect(action.instruction).toContain("使用所选写作模式");
  });

  it("passes the selected craft and disables cover generation for short fiction", () => {
    const action = buildShortStoryCreationAction({
      direction: "一名守夜人接到来自已故邻居的电话",
      chapterWordCount: 10_000,
      craftId: "craft-ghost",
    });

    expect(action.requestedIntent).toBe("short_run");
    expect(SHORT_STORY_CHAPTERS).toBe(1);
    expect(action.actionPayload.shortRun).toMatchObject({
      craftId: "craft-ghost",
      chapters: SHORT_STORY_CHAPTERS,
      charsPerChapter: 10_000,
      cover: false,
      quick: false,
    });
    expect(action.instruction).toContain("原创化改编");
    expect(action.instruction).toContain("不复制原作");
    expect(action.instruction).not.toContain("世界观、故事大纲和写作手法");
  });

  it("supports an explicit fast short-story path", () => {
    const action = buildShortStoryCreationAction({
      direction: "快速生成一个原创悬疑短篇",
      chapterWordCount: 5_000,
      craftId: "craft-short-story",
      quality: "quick",
    });

    expect(action.actionPayload.shortRun?.quick).toBe(true);
  });

  it("turns a Bilibili commentary craft into an original short-story direction", () => {
    const direction = buildDefaultStoryDirection({
      id: "craft-commentary",
      sourceName: "测试影视解说",
      mode: "bilibili-commentary",
      sourceType: "bilibili",
    }, "short", true);

    expect(direction).toContain("影视解说");
    expect(direction).toContain("原创短篇故事");
    expect(direction).toContain("全新的原创电影或故事");
    expect(direction).toContain("影视解说的角度讲述");
    expect(direction).toContain("重新设计人物、场景、因果链和结局");
  });

  it("treats a legacy Bilibili review craft as film commentary", () => {
    const direction = buildDefaultStoryDirection({
      id: "craft-review",
      sourceName: "测试评论调侃",
      mode: "bilibili-review",
      sourceType: "bilibili",
    }, "short", true);

    expect(direction).toContain("影视解说");
    expect(direction).toContain("原创短篇故事");
    expect(direction).toContain("重新设计人物、场景、因果链和结局");
    expect(direction).not.toContain("评论调侃");
  });

  it("binds dedicated video-story creation to the requested craft mode", () => {
    const action = buildShortStoryCreationAction({
      direction: "把一段电影解说的结构改造成原创悬疑故事",
      chapterWordCount: 10_000,
      craftId: "craft-commentary",
      requiredCraftMode: "bilibili-commentary",
    });

    expect(action.actionPayload.shortRun?.requiredCraftMode).toBe("bilibili-commentary");
  });
});

describe("short-story seed streaming", () => {
  it("queues a selected craft's story foundation through the background endpoint", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      craftId: "craft / 1",
      status: "pending",
      meta: { storySeedStatus: "pending" },
    }), { status: 202, headers: { "content-type": "application/json" } }));

    await expect(queueStorySeedGeneration({
      craftId: "craft / 1",
      kind: "short",
      language: "zh",
      previousDirection: "保留现实悬疑基调",
    }, fetchImpl)).resolves.toEqual({ craftId: "craft / 1", status: "pending" });

    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/crafts/craft%20%2F%201/story-seed/generate", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        craftId: "craft / 1",
        kind: "short",
        language: "zh",
        previousDirection: "保留现实悬疑基调",
      }),
    }));
  });

  it("parses structured SSE events without exposing reasoning fields", () => {
    expect(parseStorySeedStreamEvent('event: delta\ndata: {"text":"## 故事名称"}')).toEqual({
      event: "delta",
      data: { text: "## 故事名称" },
    });
    expect(parseStorySeedStreamEvent('event: reasoning\ndata: {"text":"hidden"}')).toBeNull();
  });

  it("collects deltas and resolves the parsed candidate", async () => {
    const chunks = [
      'event: start\ndata: {"sections":["title"]}\n\n',
      'event: delta\ndata: {"text":"## 故事名称\\n\\n回声"}\n\n',
      'event: complete\ndata: {"seed":{"title":"回声"},"content":"## 故事名称\\n\\n回声"}\n\n',
    ];
    const response = new Response(new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    }), { status: 200, headers: { "content-type": "text/event-stream" } });
    const events: string[] = [];

    const seed = await streamStorySeed({ kind: "short", language: "zh" }, (event) => {
      events.push(event.event);
    }, vi.fn(async () => response));

    expect(events).toEqual(["start", "delta", "complete"]);
    expect(seed).toEqual({ title: "回声" });
  });
});
