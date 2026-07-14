import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const apiState = vi.hoisted(() => ({
  data: null as { assets: StoryAsset[] } | null,
  loading: false,
  error: null as string | null,
  refetch: vi.fn(),
}));

vi.mock("../hooks/use-api", () => ({
  useApi: vi.fn(() => apiState),
  fetchJson: vi.fn(),
  postApi: vi.fn(),
}));

import {
  StoryAssetsPanel,
  buildStoryAssetImagePath,
  buildStoryAssetGenerateImagePath,
  buildStoryAssetGenerateMissingImagesPath,
  buildStoryAssetsPath,
  chooseStoryAssetId,
  chooseStoryAssetAction,
  filterStoryAssets,
  getAssetEmptyState,
  getStoryAssetActionLabel,
  getStoryAssetStatusLabel,
  hasUnreadyStoryAssetImages,
  type StoryAsset,
} from "./StoryAssetsPanel";

const assets: StoryAsset[] = [
  {
    id: "mara",
    kind: "character",
    name: "Mara",
    summary: "A careful archivist.",
    details: { role: "protagonist" },
    imagePrompt: "Portrait of Mara",
    image: { status: "ready", path: "/images/mara.png" },
  },
  {
    id: "harbor",
    kind: "scene",
    name: "Night Harbor",
    summary: "A foggy harbor.",
    details: {},
    imagePrompt: "Foggy harbor at night",
    image: { status: "missing" },
  },
  {
    id: "broken-prop",
    kind: "prop",
    name: "Broken Prop",
    summary: "A failed image.",
    details: {},
    imagePrompt: "A broken prop",
    image: { status: "error", error: "generation failed" },
  },
];

function renderPanel(manifestAssets: StoryAsset[] = assets, overrides: Partial<React.ComponentProps<typeof StoryAssetsPanel>> = {}) {
  apiState.data = { assets: manifestAssets };
  apiState.loading = false;
  apiState.error = null;
  apiState.refetch.mockClear();
  return renderToStaticMarkup(
    React.createElement(StoryAssetsPanel, {
      kind: "book",
      storyId: "demo/story",
      theme: "light",
      isZh: false,
      ...overrides,
    }),
  );
}

describe("story asset view helpers", () => {
  it("filters assets by kind while keeping all assets available", () => {
    expect(filterStoryAssets(assets, "character")).toEqual([assets[0]]);
    expect(filterStoryAssets(assets, "all")).toEqual(assets);
  });

  it("keeps the selected asset when possible and falls back to the first visible asset", () => {
    expect(chooseStoryAssetId(assets, "harbor")).toBe("harbor");
    expect(chooseStoryAssetId(assets, "unknown")).toBe("mara");
    expect(chooseStoryAssetId([], "mara")).toBeNull();
  });

  it("uses canonical story asset and safe image endpoint paths", () => {
    expect(buildStoryAssetsPath("book", "demo/story")).toBe("/stories/book/demo%2Fstory/assets");
    expect(buildStoryAssetImagePath("short", "short 1", "broken/prop")).toBe(
      "/stories/short/short%201/assets/images/broken%2Fprop",
    );
    expect(buildStoryAssetGenerateImagePath("short", "short 1", "broken/prop")).toBe(
      "/stories/short/short%201/assets/broken%2Fprop/generate-image",
    );
    expect(buildStoryAssetGenerateMissingImagesPath("book", "demo/story")).toBe(
      "/stories/book/demo%2Fstory/assets/generate-missing-images",
    );
  });

  it("enables batch generation for every non-ready image state", () => {
    expect(hasUnreadyStoryAssetImages(assets)).toBe(true);
    expect(hasUnreadyStoryAssetImages([assets[0]])).toBe(false);
  });

  it("localizes every image status and action label", () => {
    expect(getStoryAssetStatusLabel("missing", true)).toBe("缺图");
    expect(getStoryAssetStatusLabel("generating", false)).toBe("Generating");
    expect(getStoryAssetStatusLabel("ready", true)).toBe("已就绪");
    expect(getStoryAssetStatusLabel("error", false)).toBe("Error");
    expect(getStoryAssetActionLabel("missing", false)).toBe("Generate image");
    expect(getStoryAssetActionLabel("error", false)).toBe("Regenerate image");
    expect(getStoryAssetActionLabel("ready", false)).toBe("Regenerate image");
    expect(getStoryAssetActionLabel("ready", true)).toBe("重新生成");
  });

  it("uses an explicit callback instead of its fallback action", async () => {
    const callback = vi.fn();
    const fallback = vi.fn();
    await chooseStoryAssetAction(callback, fallback)(assets[0]);
    expect(callback).toHaveBeenCalledWith(assets[0]);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("returns a stable empty state for an empty filtered list", () => {
    expect(getAssetEmptyState(true)).toBe("还没有故事资产");
    expect(getAssetEmptyState(false)).toBe("No story assets yet");
    expect(renderPanel([])).toContain("No story assets yet");
  });

  it("renders safe image URLs, state-specific labels, and does not generate on mount", () => {
    const onGenerateAsset = vi.fn();
    const onGenerateMissing = vi.fn();
    const html = renderPanel(assets, { onGenerateAsset, onGenerateMissing });

    expect(html).toContain("/api/v1/stories/book/demo%2Fstory/assets/images/mara");
    expect(html).toContain("Generate all missing images");
    expect(renderPanel(assets, { isZh: true })).toContain("生成全部缺失图片");
    expect(html).toContain("Regenerate image");
    expect(onGenerateAsset).not.toHaveBeenCalled();
    expect(onGenerateMissing).not.toHaveBeenCalled();
  });

  it("renders a compact name-only asset list beside selected asset details", () => {
    const html = renderPanel();

    expect(html).toContain('data-testid="story-assets-list"');
    expect(html).toContain('data-testid="story-asset-details"');
    expect(html).toContain('data-testid="story-asset-item-mara"');
    expect(html).toContain("Mara");
    expect(html).toContain("A careful archivist.");
    expect(html).not.toContain('data-testid="story-asset-card-mara"');
  });
});
