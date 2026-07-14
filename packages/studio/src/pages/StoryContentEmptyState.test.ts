import { describe, expect, it } from "vitest";

import { hasStorySettingsContent } from "./StorySettingsPanel";
import { hasStoryProductionContent } from "./StoryScriptPanel";

describe("empty story content", () => {
  it("recognizes settings with no sections or chapters as empty", () => {
    expect(hasStorySettingsContent({ sections: [], chapters: [] })).toBe(false);
    expect(hasStorySettingsContent({ sections: [{ file: "story_frame.md" }], chapters: [] })).toBe(true);
  });

  it("recognizes a production response without a script as empty", () => {
    expect(hasStoryProductionContent({ script: { exists: false } })).toBe(false);
    expect(hasStoryProductionContent({ script: { exists: true } })).toBe(true);
  });
});
