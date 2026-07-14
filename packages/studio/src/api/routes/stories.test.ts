import { describe, expect, it } from "vitest";

import { getShortStoryWordCount } from "./stories";
import { createEmptyStoryContent } from "./stories";

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

describe("empty story content", () => {
  it("returns a valid empty payload for a deleted or not-yet-created story", () => {
    expect(createEmptyStoryContent("ghost-story", "short")).toEqual({
      book: { title: "ghost-story", genre: "short", chapterWordCount: 0, targetChapters: 1 },
      sections: [],
      chapters: [],
    });
  });
});
