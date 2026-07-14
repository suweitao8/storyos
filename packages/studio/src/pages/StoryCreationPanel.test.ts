import { describe, expect, it } from "vitest";
import { STORY_CREATION_LAYOUT_CLASSES } from "./StoryCreationPanel";

describe("story creation layout", () => {
  it("uses one full-width column for the controls and preview", () => {
    expect(STORY_CREATION_LAYOUT_CLASSES.workspace).toContain("w-full");
    expect(STORY_CREATION_LAYOUT_CLASSES.workspace).not.toContain("max-w-[1440px]");
    expect(STORY_CREATION_LAYOUT_CLASSES.columns).not.toContain("lg:grid-cols-");
  });
});
