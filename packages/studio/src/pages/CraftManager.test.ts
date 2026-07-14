import { describe, expect, it } from "vitest";

import {
  buildCraftAnalyzePayload,
  CRAFT_DETAIL_TABS,
  craftCardDescription,
  craftCardTitle,
  craftCardMeta,
  craftSourceTypeLabel,
  formatCraftBeatDuration,
} from "./CraftManager";

describe("craft mode presentation", () => {
  it("uses the source name as the card title without a craft subtype", () => {
    expect(craftCardTitle({ sourceName: "示例视频", mode: "ghost-story" })).toBe("示例视频");
  });

  it("only presents video and novel source types", () => {
    expect(craftSourceTypeLabel("bilibili")).toBe("视频解析");
    expect(craftSourceTypeLabel("novel")).toBe("小说解析");
  });

  it("combines the source type and recommended word count into one card label", () => {
    expect(craftCardMeta({ sourceType: "bilibili", recommendedWordCount: 22_000 }))
      .toBe("视频解析 · 建议约 22,000 字");
    expect(craftCardMeta({ sourceType: "novel" })).toBe("小说解析");
  });

  it("organizes craft detail into focused tabs", () => {
    expect(CRAFT_DETAIL_TABS.map((tab) => tab.value)).toEqual([
      "overview",
      "story",
      "video",
      "modules",
      "exemplars",
      "source",
    ]);
  });

  it("uses a generic fallback description for legacy ghost-story records", () => {
    expect(craftCardDescription({ mode: "ghost-story" })).not.toContain("鬼故事");
  });

  it("always analyzes new sources with the general-compatible mode", () => {
    expect(buildCraftAnalyzePayload({
      type: "bilibili",
      text: "字幕内容",
      detectedName: "视频标题",
    })).toMatchObject({
      sourceType: "bilibili",
      mode: "general",
    });
  });

  it("formats beat time ranges as clean start–end labels", () => {
    expect(formatCraftBeatDuration("00:00-00:40")).toBe("0秒–40秒");
    expect(formatCraftBeatDuration("3.1s-5.2s")).toBe("3秒–5秒");
    expect(formatCraftBeatDuration("00:00:40-00:02:00")).toBe("40秒–2分");
    expect(formatCraftBeatDuration(undefined)).toBeUndefined();
  });
});
