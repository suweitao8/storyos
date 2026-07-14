import { describe, expect, it } from "vitest";

import {
  shouldShowStoryAssetEmptyState,
  type StoryAssetManifest,
} from "./StoryAssetsPanel";

describe("story asset empty state", () => {
  it("treats a missing story or an empty manifest as no content", () => {
    const emptyManifest: StoryAssetManifest = { assets: [] };

    expect(shouldShowStoryAssetEmptyState(null, null, false)).toBe(true);
    expect(shouldShowStoryAssetEmptyState(emptyManifest, "deleted-story", false)).toBe(true);
    expect(shouldShowStoryAssetEmptyState({ assets: [{ id: "hero" }] as never }, "story", false)).toBe(false);
  });

  it("does not replace the loading state before the request resolves", () => {
    expect(shouldShowStoryAssetEmptyState(null, "story", true)).toBe(false);
  });
});
