import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  StoryAssetsPanel,
  filterStoryAssets,
  getAssetEmptyState,
  getStoryAssetStatusLabel,
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
];

describe("story asset view helpers", () => {
  it("filters assets by kind while keeping all assets available", () => {
    expect(filterStoryAssets(assets, "character")).toEqual([assets[0]]);
    expect(filterStoryAssets(assets, "all")).toEqual(assets);
  });

  it("localizes every image status label", () => {
    expect(getStoryAssetStatusLabel("missing", true)).toBe("缺图");
    expect(getStoryAssetStatusLabel("generating", false)).toBe("Generating");
    expect(getStoryAssetStatusLabel("ready", true)).toBe("已就绪");
    expect(getStoryAssetStatusLabel("error", false)).toBe("Error");
  });

  it("returns a stable empty state for an empty filtered list", () => {
    expect(getAssetEmptyState(true)).toBe("还没有故事资产");
    expect(getAssetEmptyState(false)).toBe("No story assets yet");
  });

  it("does not call image generation while the panel mounts", () => {
    const onGenerateAsset = vi.fn();
    const onGenerateMissing = vi.fn();
    const html = renderToStaticMarkup(
      React.createElement(StoryAssetsPanel, {
        kind: "book",
        storyId: "demo",
        theme: "light",
        isZh: true,
        onGenerateAsset,
        onGenerateMissing,
      }),
    );

    expect(html).toContain("故事资产");
    expect(onGenerateAsset).not.toHaveBeenCalled();
    expect(onGenerateMissing).not.toHaveBeenCalled();
  });
});
