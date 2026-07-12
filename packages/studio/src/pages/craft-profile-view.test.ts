import { describe, expect, it } from "vitest";
import {
  CRAFT_LAYOUT_CLASSES,
  CRAFT_TABS,
  buildCraftDetailModel,
  craftListRowClassName,
  craftModuleCategoryLabel,
  resolveCraftDeleteSelection,
  advanceCraftNavigationToken,
  shouldApplyCraftDeleteFallback,
  CRAFT_SOURCE_TYPES,
  buildCraftAnalyzePayload,
  CRAFT_LIST_GRID_CLASS,
  craftCardTitle,
  craftSourceTypeLabel,
  craftCardDescription,
} from "./CraftManager";

describe("craft card list presentation", () => {
  it("uses a two-column grid without the previous three-column expansion", () => {
    expect(CRAFT_LIST_GRID_CLASS).toContain("xl:grid-cols-4");
    expect(CRAFT_LIST_GRID_CLASS).not.toContain("sm:grid-cols-2");
  });

  it("shows the craft type after the title and the source type separately", () => {
    expect(craftCardTitle({ sourceName: "测试故事", mode: "ghost-story" })).toBe("测试故事 · 鬼故事");
    expect(craftSourceTypeLabel("bilibili")).toBe("视频解析");
    expect(craftSourceTypeLabel("novel")).toBe("小说解析");
  });

  it("shows the extracted story summary instead of only a generic mode hint", () => {
    expect(craftCardDescription({
      mode: "ghost-story",
      summary: "夜班维修员在停电的旧楼里发现每层电梯都通向同一间不存在的房间。",
    })).toContain("夜班维修员");
    expect(craftCardDescription({ mode: "general", summary: "  " })).toContain("场景节奏");
  });
});

describe("craft source entrypoints", () => {
  it("exposes the two automatic creation sources in a stable order", () => {
    expect(CRAFT_SOURCE_TYPES).toEqual([
      { value: "bilibili", label: "B 站视频链接" },
      { value: "novel", label: "小说文本文件" },
    ]);
  });

  it.each([
    ["bilibili", "字幕内容", "鬼故事视频"],
    ["novel", "小说正文", "示例小说"],
  ] as const)("builds the shared analyze payload for %s", (type, text, detectedName) => {
    expect(buildCraftAnalyzePayload({ type, text, detectedName }, "ghost-story")).toEqual({
      text,
      sourceName: detectedName,
      sourceType: type,
      language: "zh",
      mode: "ghost-story",
    });
  });
});

describe("craft navigation model", () => {
  it("keeps all three craft tabs permanently available", () => {
    expect(CRAFT_TABS).toEqual(["list", "create", "detail"]);
  });
});

describe("craft list selection", () => {
  it("keeps the selected craft when deleting a different craft without persisting a fallback", () => {
    expect(resolveCraftDeleteSelection("craft-1", "craft-2", ["craft-1"])).toEqual({
      selectedCraftId: "craft-1",
      shouldPersistRecentCraft: false,
    });
  });

  it("highlights only the selected craft row", () => {
    expect(craftListRowClassName(true, "border-border")).toContain("bg-primary/5");
    expect(craftListRowClassName(true, "border-border")).toContain("rounded-2xl");
    expect(craftListRowClassName(true, "border-border")).toContain("flex-col");
    expect(craftListRowClassName(false, "border-border")).toContain("border-border");
    expect(craftListRowClassName(false, "border-border")).not.toContain("bg-primary/5");
  });

  it("only applies a delete fallback for the current operation and deleted selection", () => {
    expect(shouldApplyCraftDeleteFallback("craft-new", "craft-deleted", 1, 1)).toBe(false);
    expect(shouldApplyCraftDeleteFallback("craft-deleted", "craft-deleted", 2, 2)).toBe(true);
  });

  it("invalidates a pending delete fallback when tab navigation advances the selection token", () => {
    expect(advanceCraftNavigationToken(4)).toBe(5);
    expect(shouldApplyCraftDeleteFallback("craft-deleted", "craft-deleted", 4, 5)).toBe(false);
  });
});

describe("craft manager layout", () => {
  it("uses the full content width and evenly distributes the tab bar", () => {
    expect(CRAFT_LAYOUT_CLASSES.content).toContain("w-full");
    expect(CRAFT_LAYOUT_CLASSES.content).not.toMatch(/\b(?:max-w-3xl|w-fit)\b/);
    expect(CRAFT_LAYOUT_CLASSES.tabBar).toContain("w-full");
    expect(CRAFT_LAYOUT_CLASSES.tab).toContain("flex-1");
    expect(CRAFT_LAYOUT_CLASSES.tabBar).not.toMatch(/\b(?:max-w-3xl|w-fit)\b/);
  });
});

describe("craft detail model", () => {
  it("localizes module categories for the detail view", () => {
    expect(craftModuleCategoryLabel("chapterFlow", "zh")).toBe("章节推进");
    expect(craftModuleCategoryLabel("chapterFlow", "en")).toBe("Chapter Flow");
  });

  it("surfaces fallback modules and legacy sections together", () => {
    const detail = buildCraftDetailModel({
      sourceName: "测试小说",
      analyzedAt: new Date().toISOString(),
      language: "zh",
      worldview: "封闭社区以记忆交换通行资格。",
      storyOutline: "外来者在危机中进入社区，触犯规则后必须付出代价并重新定义规则。",
      structure: {
        openingPattern: "先抛异常事件，再补背景。",
        chapterArc: "单章从异状到加码。",
        endingHookType: "留下悬念。",
      },
      sceneRhythm: {
        sceneTransitionTechnique: "用动作硬切场景。",
        pacingCurve: "先压后抬。",
        conflictEscalation: "围绕矛盾层层升级。",
      },
      informationDisclosure: {
        foreshadowingDensity: "高频埋点。",
        informationReleaseRhythm: "一点一点释放。",
        suspenseManagement: "持续吊着新疑点。",
      },
      narrativePerspective: {
        povStrategy: "贴近主角的第三人称。",
        narrationDialogueRatio: "叙述多于对话。",
        narrativeDistance: "视角贴近。",
      },
      exemplars: [],
    });

    expect(detail.moduleCount).toBeGreaterThanOrEqual(8);
    expect(detail.legacySections).toHaveLength(4);
    expect(detail.worldview).toContain("封闭社区");
    expect(detail.storyOutline).toContain("外来者");
    expect(detail.modules[0]?.label).toBe("开篇钩子");
    expect(detail.modules.some((item) => item.label.includes("悬念"))).toBe(true);
  });
});
