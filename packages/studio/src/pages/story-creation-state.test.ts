import { describe, expect, it, vi } from "vitest";
import {
  buildDefaultStoryDirection,
  buildStoryWordCountOptions,
  formatStoryWordCount,
  buildLongStoryCreationAction,
  buildShortStoryCreationAction,
  LONG_STORY_CHAPTERS,
  SHORT_STORY_CHAPTERS,
  STORY_WORD_COUNT_OPTIONS,
  normalizeStoryWordCount,
  resolveDefaultStoryWordCount,
  shouldAutoGenerateShortStorySeed,
} from "./story-creation-state";
import {
  parseStorySeedStreamEvent,
  streamStorySeed,
} from "./story-seed-stream";

describe("story creation actions", () => {
  it("skips automatic short-story generation when the selected craft has a cached seed", () => {
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
    expect(shouldAutoGenerateShortStorySeed()).toBe(true);
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
      quick: true,
    });
    expect(action.instruction).toContain("世界观、故事大纲和写作手法");
    expect(action.instruction).toContain("不复制原作");
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
    expect(direction).toContain("重新设计人物、场景、因果链和结局");
  });
});

describe("short-story seed streaming", () => {
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
