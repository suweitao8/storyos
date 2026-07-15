import { describe, expect, it } from "vitest";
import { validateSourceSegmentRef } from "../models/source-alignment.js";

describe("source alignment contracts", () => {
  it("accepts only confirmed references that point to the original source video", () => {
    expect(validateSourceSegmentRef({
      matchId: "match-1",
      sourceFileKey: "sourceVideo",
      startSeconds: 12,
      endSeconds: 18,
      status: "confirmed",
    }, 120)).toEqual({ ok: true });
  });

  it("rejects commentary-video references, reversed ranges, and suggested matches", () => {
    expect(validateSourceSegmentRef({
      matchId: "match-1",
      sourceFileKey: "commentaryVideo",
      startSeconds: 18,
      endSeconds: 12,
      status: "suggested",
    }, 120)).toMatchObject({ ok: false });
  });
});
