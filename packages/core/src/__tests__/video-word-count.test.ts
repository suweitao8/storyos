import { describe, expect, it } from "vitest";
import { estimateVideoNovelWordCount } from "../craft/video-word-count.js";

describe("estimateVideoNovelWordCount", () => {
  it("ignores subtitle timestamps and returns a stable prose range", () => {
    const estimate = estimateVideoNovelWordCount(
      "[0.0s] 夜班人员走进楼道\n[8.0s] 走廊尽头传来敲门声",
      "ghost-story",
      120,
      "zh",
    );

    expect(estimate.sourceCharacterCount).toBe(17);
    expect(estimate.recommended).toBe(1000);
    expect(estimate.min).toBe(1000);
    expect(estimate.max).toBe(1000);
    expect(estimate.sourceDurationSeconds).toBe(120);
    expect(estimate.rationale).toContain("字幕有效字数");
  });

  it("uses duration as a fallback when subtitles contain no words", () => {
    const estimate = estimateVideoNovelWordCount("[0.0s] ---", "general", 600, "zh");

    expect(estimate.sourceCharacterCount).toBe(0);
    expect(estimate.recommended).toBe(3800);
    expect(estimate.min).toBe(3100);
    expect(estimate.max).toBe(4700);
  });
});
