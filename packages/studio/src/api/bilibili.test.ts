import { describe, expect, it } from "vitest";
import { parseBvid, selectDashMediaUrls, subtitleText } from "./bilibili.js";

describe("Bilibili subtitle import helpers", () => {
  it("accepts a BV number or a full Bilibili video URL", () => {
    expect(parseBvid("BV1YBTb6sEEr")).toBe("BV1YBTb6sEEr");
    expect(parseBvid("https://www.bilibili.com/video/BV1YBTb6sEEr/?spm_id_from=333")).toBe("BV1YBTb6sEEr");
  });

  it("rejects arbitrary text and malformed BV numbers", () => {
    expect(parseBvid("not a bilibili link")).toBeNull();
    expect(parseBvid("https://example.com/video/BV1YBTb6sEEr")).toBeNull();
    expect(parseBvid("BV1YBTb6sEE")).toBeNull();
  });

  it("selects playable DASH video and audio tracks", () => {
    expect(selectDashMediaUrls({
      video: [{ baseUrl: "video-main", backupUrl: ["video-backup"] }],
      audio: [{ baseUrl: "audio-main", backupUrl: ["audio-backup"] }],
    })).toEqual({ videoUrl: "video-main", audioUrl: "audio-main" });
  });

  it("serializes timestamped subtitles for the retained source file", () => {
    expect(subtitleText([
      { from: 0, to: 1.25, content: "第一句" },
      { from: 1.25, to: 2, content: "第二句" },
    ])).toBe("[0.0s-1.3s] 第一句\n[1.3s-2.0s] 第二句");
  });
});
