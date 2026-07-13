import { describe, expect, it } from "vitest";
import {
  SHORT_FICTION_DEFAULT_CHAPTERS,
  SHORT_FICTION_MAX_CHAPTERS,
  SHORT_FICTION_MAX_CHARS_PER_CHAPTER,
  SHORT_FICTION_MIN_CHAPTERS,
} from "../agents/short-fiction.js";
import { ShortRunActionPayloadSchema } from "../interaction/action-envelope.js";

describe("fixed story lengths", () => {
  it("accepts one chapter and rejects zero chapters", () => {
    expect(SHORT_FICTION_MIN_CHAPTERS).toBe(1);
    expect(SHORT_FICTION_DEFAULT_CHAPTERS).toBe(1);
    expect(SHORT_FICTION_MAX_CHAPTERS).toBe(18);
    expect(ShortRunActionPayloadSchema.parse({ chapters: 1 }).chapters).toBe(1);
    expect(() => ShortRunActionPayloadSchema.parse({ chapters: 0 })).toThrow();
  });

  it("accepts a video craft recommendation above the old 10000-character cap", () => {
    expect(SHORT_FICTION_MAX_CHARS_PER_CHAPTER).toBe(100_000);
    expect(ShortRunActionPayloadSchema.parse({ charsPerChapter: 20_200 }).charsPerChapter).toBe(20_200);
    expect(ShortRunActionPayloadSchema.parse({ charsPerChapter: 30_000 }).charsPerChapter).toBe(30_000);
  });
});
