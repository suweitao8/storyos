import { describe, expect, it } from "vitest";
import { buildLongStoryCreationAction, buildShortStoryCreationAction } from "./story-creation-state";

describe("story creation actions", () => {
  it("binds the selected craft to long-form book creation", () => {
    const action = buildLongStoryCreationAction({
      title: "夜港账本",
      genre: "悬疑",
      direction: "一名巡夜人发现港口的失踪记录会提前一天出现",
      platform: "tomato",
      language: "zh",
      targetChapters: 200,
      chapterWordCount: 3000,
      craftId: "craft-ghost",
    });

    expect(action.requestedIntent).toBe("create_book");
    expect(action.actionPayload.createBook?.craftId).toBe("craft-ghost");
    expect(action.instruction).toContain("使用所选写作模式");
  });

  it("passes the selected craft and disables cover generation for short fiction", () => {
    const action = buildShortStoryCreationAction({
      direction: "一名守夜人接到来自已故邻居的电话",
      chapters: 12,
      charsPerChapter: 1000,
      craftId: "craft-ghost",
    });

    expect(action.requestedIntent).toBe("short_run");
    expect(action.actionPayload.shortRun).toMatchObject({
      craftId: "craft-ghost",
      chapters: 12,
      charsPerChapter: 1000,
      cover: false,
    });
  });
});
