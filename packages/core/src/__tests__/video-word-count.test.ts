import { describe, expect, it } from "vitest";
import { estimateVideoNovelWordCount } from "../craft/video-word-count.js";

describe("estimateVideoNovelWordCount", () => {
  it("ignores subtitle timestamps and returns one rounded target", () => {
    const estimate = estimateVideoNovelWordCount(
      "[0.0s] 夜班人员走进楼道\n[8.0s] 走廊尽头传来敲门声",
      "ghost-story",
      120,
      "zh",
    );

    expect(estimate.sourceCharacterCount).toBe(17);
    expect(estimate.recommended).toBe(1000);
    expect(estimate.min).toBeUndefined();
    expect(estimate.max).toBeUndefined();
    expect(estimate.sourceDurationSeconds).toBe(120);
    expect(estimate.rationale).toContain("字幕有效字数");
  });

  it("does not expand a subtitle source by a multiplier", () => {
    const estimate = estimateVideoNovelWordCount("字".repeat(13_020), "ghost-story", 1200, "zh");

    expect(estimate.sourceCharacterCount).toBe(13_020);
    expect(estimate.recommended).toBe(13_000);
    expect(estimate.min).toBeUndefined();
    expect(estimate.max).toBeUndefined();
    expect(estimate.rationale).not.toContain("1.55");
  });

  it("uses duration as a fallback and rounds to thousands", () => {
    const estimate = estimateVideoNovelWordCount("[0.0s] ---", "general", 600, "zh");

    expect(estimate.sourceCharacterCount).toBe(0);
    expect(estimate.recommended).toBe(3_000);
    expect(estimate.min).toBeUndefined();
    expect(estimate.max).toBeUndefined();
  });
});
