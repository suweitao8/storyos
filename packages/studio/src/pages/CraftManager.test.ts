import { describe, expect, it } from "vitest";

import {
  buildCraftAnalyzePayload,
  craftCardDescription,
  craftCardTitle,
  craftSourceTypeLabel,
} from "./CraftManager";

describe("craft mode presentation", () => {
  it("shows the selected subtype after the source name", () => {
    expect(craftCardTitle({ sourceName: "示例视频", mode: "bilibili-commentary", sourceType: "bilibili" })).toBe("示例视频 · B站影视解说");
  });

  it("only presents video and novel source types", () => {
    expect(craftSourceTypeLabel("bilibili")).toBe("B站视频");
    expect(craftSourceTypeLabel("novel")).toBe("小说");
  });

  it("uses a generic fallback description for legacy ghost-story records", () => {
    expect(craftCardDescription({ mode: "ghost-story" })).not.toContain("鬼故事");
  });

  it("analyzes B站 sources with the selected subtype", () => {
    expect(buildCraftAnalyzePayload({
      type: "bilibili",
      text: "字幕内容",
      detectedName: "视频标题",
    }, "bilibili-short-story")).toMatchObject({
      sourceType: "bilibili",
      mode: "bilibili-short-story",
    });
  });
});
