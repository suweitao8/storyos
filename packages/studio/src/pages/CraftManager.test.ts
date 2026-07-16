import { describe, expect, it } from "vitest";

import {
  buildCraftAnalyzePayload,
  CRAFT_DETAIL_TABS,
  craftCardDescription,
  craftCardTitle,
  craftCardMeta,
  craftSourceTypeLabel,
  craftProcessingErrorText,
  craftSourceFilesForDisplay,
  formatCraftBeatDuration,
  shouldReloadCraftProfileAfterStatus,
  storySeedViewStatus,
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

  it("does not expose original-film alignment files in the source tab", () => {
    expect(craftSourceFilesForDisplay([
      { key: "video" },
      { key: "sourceVideo" },
      { key: "timeline" },
      { key: "subtitlesText" },
    ] as never).map((file) => file.key)).toEqual(["video", "subtitlesText"]);
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

  it("shows the failed processing stage together with the underlying error", () => {
    expect(craftProcessingErrorText({
      processingStage: "正在获取视频与字幕",
      processingError: "Bcut 识别超时",
    })).toBe("阶段：正在获取视频与字幕；错误详情：Bcut 识别超时");
  });

  it("does not reload an already loaded profile while only its score is pending", () => {
    const storySeed = {
      title: "测试故事",
      worldview: "现实都市中的异常订单。",
      outline: "主角调查订单留下的物证。",
    };

    expect(shouldReloadCraftProfileAfterStatus("ready", {
      storySeedStatus: "ready",
      storySeed,
    })).toBe(false);
    expect(shouldReloadCraftProfileAfterStatus("ready", {
      storySeedStatus: "ready",
    })).toBe(true);
    expect(shouldReloadCraftProfileAfterStatus("processing", {
      storySeedStatus: "pending",
    })).toBe(false);
  });

  it("tracks story seed replacement status across background refreshes", () => {
    expect(storySeedViewStatus({ storySeed: { title: "旧设定" } as never, storySeedStatus: "pending" })).toBe("generating");
    expect(storySeedViewStatus({ storySeed: { title: "新设定" } as never, storySeedStatus: "ready" })).toBe("ready");
    expect(storySeedViewStatus({ storySeedStatus: "error" })).toBe("error");
    expect(storySeedViewStatus({})).toBe("idle");
  });
});
