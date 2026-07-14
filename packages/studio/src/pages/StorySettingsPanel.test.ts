import { describe, expect, it } from "vitest";

import { buildStorySettingsTabItems, groupStorySection } from "./StorySettingsPanel";

describe("groupStorySection", () => {
  it("classifies generated short-outline sections into useful display groups", () => {
    expect(groupStorySection({ file: "outline/v001.md#section-1", title: "题材/受众" })).toBe("settings");
    expect(groupStorySection({ file: "outline/v001.md#section-2", title: "人物与关系" })).toBe("characters");
    expect(groupStorySection({ file: "outline/v001.md#section-3", title: "反转链" })).toBe("outline");
    expect(groupStorySection({ file: "outline/v001.md#section-4", title: "世界规则" })).toBe("world");
  });

  it("builds navigation tabs for long setting documents and chapters", () => {
    const groups = [
      ["settings", [{ file: "story_frame.md", title: "故事设定" }]],
      ["world", [{ file: "rules.md", title: "世界规则" }]],
      ["outline", [{ file: "outline.md", title: "故事大纲" }]],
    ] as const;

    expect(buildStorySettingsTabItems(groups, 3, true)).toEqual([
      { id: "settings", label: "故事设定", count: 1 },
      { id: "world", label: "世界观与规则", count: 1 },
      { id: "outline", label: "故事大纲", count: 1 },
      { id: "chapters", label: "章节", count: 3 },
    ]);
    expect(buildStorySettingsTabItems(groups, 1, true, true).at(-1)).toEqual({
      id: "chapters",
      label: "故事正文",
      count: 0,
    });
  });
});
