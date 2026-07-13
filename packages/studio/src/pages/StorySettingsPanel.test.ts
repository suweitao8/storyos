import { describe, expect, it } from "vitest";

import { groupStorySection } from "./StorySettingsPanel";

describe("groupStorySection", () => {
  it("classifies generated short-outline sections into useful display groups", () => {
    expect(groupStorySection({ file: "outline/v001.md#section-1", title: "题材/受众" })).toBe("settings");
    expect(groupStorySection({ file: "outline/v001.md#section-2", title: "人物与关系" })).toBe("characters");
    expect(groupStorySection({ file: "outline/v001.md#section-3", title: "反转链" })).toBe("outline");
    expect(groupStorySection({ file: "outline/v001.md#section-4", title: "世界规则" })).toBe("world");
  });
});
