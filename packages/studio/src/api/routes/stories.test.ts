import { describe, expect, it } from "vitest";

import { getShortStoryWordCount } from "./stories";

describe("getShortStoryWordCount", () => {
  it("uses artifact chapter counts instead of counting markdown headings", () => {
    expect(getShortStoryWordCount("# 标题\n\n## 第1章\n\n正文", {
      chapters: [{ charCount: 4_293 }],
    })).toBe(4_293);
  });

  it("falls back to prose-only counting for legacy markdown artifacts", () => {
    expect(getShortStoryWordCount("# 标题\n\n## 第1章\n\n正文内容", undefined)).toBe(4);
  });
});
