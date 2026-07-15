import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STORY_CREATION_LAYOUT_CLASSES, StoryCreationPanel } from "./StoryCreationPanel";

describe("story creation layout", () => {
  it("uses one full-width column for the controls and preview", () => {
    expect(STORY_CREATION_LAYOUT_CLASSES.workspace).toContain("w-full");
    expect(STORY_CREATION_LAYOUT_CLASSES.workspace).not.toContain("max-w-[1440px]");
    expect(STORY_CREATION_LAYOUT_CLASSES.columns).not.toContain("lg:grid-cols-");
  });

  it("passes persisted background scoring results into the story foundation preview", () => {
    const html = renderToStaticMarkup(createElement(StoryCreationPanel, {
      kind: "short",
      theme: "dark",
      isZh: true,
      activeSessionId: "session-1",
      busy: false,
      craftsLoading: false,
      crafts: [{
        id: "craft-1",
        sourceName: "现实悬疑模式",
        mode: "bilibili-short-story",
        sourceType: "bilibili",
        storySeed: {
          title: "回声井", genreTone: "现实悬疑", hook: "钩子", worldview: "现实场景",
          characters: "角色", conflict: "冲突", outline: "大纲", reversals: "反转", ending: "结局", visualAudioMotifs: "氛围",
        },
        storySeedScore: 85,
        storySeedScoreNote: "题材与现实感稳定",
        storySeedScoreStatus: "ready",
      }],
      selectedCraftId: "craft-1",
      onCraftChange: () => undefined,
      onCreateLong: async () => undefined,
      onCreateShort: async () => undefined,
      onGenerateSeed: async () => undefined,
    }));

    expect(html).toContain("85");
    expect(html).toContain("题材与现实感稳定");
  });

  it("hides an outdated seed while its replacement is generating in the background", () => {
    const html = renderToStaticMarkup(createElement(StoryCreationPanel, {
      kind: "short",
      theme: "dark",
      isZh: true,
      activeSessionId: "session-1",
      busy: false,
      craftsLoading: false,
      crafts: [{
        id: "craft-1", sourceName: "现实悬疑模式", mode: "bilibili-short-story", sourceType: "bilibili",
        storySeedStatus: "pending",
        storySeed: {
          title: "即将替换的旧设定", genreTone: "现实悬疑", hook: "钩子", worldview: "现实场景",
          characters: "角色", conflict: "冲突", outline: "大纲", reversals: "反转", ending: "结局", visualAudioMotifs: "氛围",
        },
      }],
      selectedCraftId: "craft-1",
      onCraftChange: () => undefined,
      onCreateLong: async () => undefined,
      onCreateShort: async () => undefined,
      onGenerateSeed: async () => undefined,
    }));

    expect(html).toContain("后台生成故事设定");
    expect(html).not.toContain("即将替换的旧设定");
  });
});
