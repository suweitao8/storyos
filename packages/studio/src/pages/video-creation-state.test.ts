import { describe, expect, it } from "vitest";
import { buildVideoCreationAction } from "./video-creation-state";

describe("video creation actions", () => {
  it("binds film commentary creation to the commentary craft mode", () => {
    const action = buildVideoCreationAction({
      type: "film-commentary",
      title: "夜班电梯解说",
      direction: "围绕一个午夜电梯谜案制作旁白驱动的视频解说。",
      craftId: "craft-commentary",
      episodeDuration: "3分钟",
      language: "zh",
    });

    expect(action.requestedIntent).toBe("script_create");
    expect(action.actionPayload.scriptCreate).toMatchObject({
      craftId: "craft-commentary",
      requiredCraftMode: "bilibili-commentary",
      targetFormat: "general_script",
      sourceKind: "影视解说写作模式",
    });
    expect(action.instruction).toContain("影视解说");
  });

  it("binds review creation to the review craft mode", () => {
    const action = buildVideoCreationAction({
      type: "review-commentary",
      title: "本周电影吐槽",
      direction: "用轻松调侃的方式评论一部新片的逻辑漏洞。",
      craftId: "craft-review",
      episodeDuration: "5分钟",
      language: "zh",
    });

    expect(action.actionPayload.scriptCreate?.requiredCraftMode).toBe("bilibili-review");
    expect(action.actionPayload.scriptCreate?.requirements).toContain("评论调侃");
  });
});
