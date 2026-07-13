import { describe, expect, it } from "vitest";
import { STORY_CREATION_LAYOUT_CLASSES } from "./StoryCreationPanel";

describe("story creation layout", () => {
  it("uses a wide responsive workspace with a main column and support column", () => {
    expect(STORY_CREATION_LAYOUT_CLASSES.workspace).toContain("max-w-[1440px]");
    expect(STORY_CREATION_LAYOUT_CLASSES.columns).toContain("lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]");
  });
});
