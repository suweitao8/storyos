import { describe, expect, it } from "vitest";
import {
  buildDefaultStoryDirection,
  buildStoryWordCountOptions,
  buildLongStoryCreationAction,
  buildShortStoryCreationAction,
  LONG_STORY_CHAPTERS,
  SHORT_STORY_CHAPTERS,
  STORY_WORD_COUNT_OPTIONS,
  resolveDefaultStoryWordCount,
} from "./story-creation-state";

describe("story creation actions", () => {
  it("builds an editable original direction for the selected craft", () => {
    const direction = buildDefaultStoryDirection({ id: "ghost", sourceName: "reference", mode: "ghost-story" }, "short", true);

    expect(direction).toContain("完全原创");
    expect(direction).toContain("不得复制参考作品");
    expect(direction).toContain("第二次敲门");
  });

  it("exposes the supported per-chapter word-count settings", () => {
    expect(STORY_WORD_COUNT_OPTIONS).toEqual([1_000, 2_000, 5_000, 10_000]);
  });

  it("adds the selected craft recommendation without removing fixed choices", () => {
    expect(buildStoryWordCountOptions(42_900)).toEqual([1_000, 2_000, 5_000, 10_000, 42_900]);
    expect(resolveDefaultStoryWordCount(42_900)).toBe(42_900);
    expect(resolveDefaultStoryWordCount()).toBe(10_000);
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
