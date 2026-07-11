import { describe, expect, it } from "vitest";
import {
  SHORT_FICTION_DEFAULT_CHAPTERS,
  SHORT_FICTION_MAX_CHAPTERS,
  SHORT_FICTION_MIN_CHAPTERS,
} from "../agents/short-fiction.js";
import { ShortRunActionPayloadSchema } from "../interaction/action-envelope.js";

describe("fixed story lengths", () => {
  it("accepts ten chapters and rejects the old twelve-chapter minimum", () => {
    expect(SHORT_FICTION_MIN_CHAPTERS).toBe(10);
    expect(SHORT_FICTION_DEFAULT_CHAPTERS).toBe(10);
    expect(SHORT_FICTION_MAX_CHAPTERS).toBe(18);
    expect(ShortRunActionPayloadSchema.parse({ chapters: 10 }).chapters).toBe(10);
    expect(() => ShortRunActionPayloadSchema.parse({ chapters: 9 })).toThrow();
  });
});
