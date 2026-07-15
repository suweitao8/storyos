import { describe, expect, it } from "vitest";
import { STORY_SEED_MIN_CREATION_SCORE } from "../../../core/src/models/story-seed-constants";

describe("story seed browser-safe constants", () => {
  it("keeps the creation threshold available without loading the core barrel", () => {
    expect(STORY_SEED_MIN_CREATION_SCORE).toBe(70);
  });
});
