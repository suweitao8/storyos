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
  CRAFT_VIDEO_MODES,
  buildCraftAnalyzePayload,
  CRAFT_LIST_GRID_CLASS,
  craftCardTitle,
  craftModeLabel,
  craftSourceTypeLabel,
  craftCardDescription,
} from "./CraftManager";

describe("craft card list presentation", () => {
  it("uses a two-column grid without the previous three-column expansion", () => {
    expect(CRAFT_LIST_GRID_CLASS).toContain("xl:grid-cols-4");
    expect(CRAFT_LIST_GRID_CLASS).not.toContain("sm:grid-cols-2");
  });

  it("shows the source name and selected craft subtype", () => {
    expect(craftCardTitle({ sourceName: "测试故事", mode: "bilibili-commentary", sourceType: "bilibili" })).toBe("测试故事 · B站影视解说");
    expect(craftCardTitle({ sourceName: "旧模式", mode: "ghost-story", sourceType: "bilibili" })).toBe("旧模式 · B站视频");
    expect(craftSourceTypeLabel("bilibili")).toBe("B站视频");
    expect(craftSourceTypeLabel("novel")).toBe("小说");
    expect(craftSourceTypeLabel(undefined)).toBe("来源未记录");
    expect(craftModeLabel("bilibili-short-story", "bilibili")).toBe("B站短篇故事");
  });

  it("shows the extracted story summary instead of only a generic mode hint", () => {
    expect(craftCardDescription({
      mode: "bilibili-commentary",
      summary: "夜班维修员在停电的旧楼里发现每层电梯都通向同一间不存在的房间。",
    })).toContain("夜班维修员");
    expect(craftCardDescription({ mode: "general", summary: "  " })).toContain("场景节奏");
  });
});

describe("craft source entrypoints", () => {
  it("exposes the two automatic creation sources in a stable order", () => {
    expect(CRAFT_SOURCE_TYPES).toEqual([
      { value: "novel", label: "小说" },
      { value: "bilibili", label: "B站视频" },
    ]);
    expect(CRAFT_VIDEO_MODES).toEqual([
      { value: "bilibili-short-story", label: "B站短篇故事" },
      { value: "bilibili-commentary", label: "B站影视解说" },
    ]);
  });

  it.each([
    ["bilibili", "字幕内容", "鬼故事视频"],
    ["novel", "小说正文", "示例小说"],
  ] as const)("builds the shared analyze payload for %s", (type, text, detectedName) => {
    expect(buildCraftAnalyzePayload({ type, text, detectedName }, type === "bilibili" ? "bilibili-short-story" : "general")).toEqual({
      text,
      sourceName: detectedName,
      sourceType: type,
      language: "zh",
      mode: type === "bilibili" ? "bilibili-short-story" : "general",
    });
  });

  it("preserves the Bilibili commentary subtype for later short-story creation", () => {
    expect(buildCraftAnalyzePayload({
      type: "bilibili",
      text: "影视解说字幕",
      detectedName: "测试影视解说",
    }, "bilibili-commentary").mode).toBe("bilibili-commentary");
  });

  it("carries a stable source reference for video reparsing", () => {
    expect(buildCraftAnalyzePayload({
      type: "bilibili",
      text: "字幕",
      detectedName: "测试视频",
      sourceRef: "BV1YBTb6sEEr",
    }, "ghost-story").sourceRef).toBe("BV1YBTb6sEEr");
  });

  it("carries the video duration for word-count estimation", () => {
    expect(buildCraftAnalyzePayload({
      type: "bilibili",
      text: "字幕",
      detectedName: "测试视频",
      sourceDurationSeconds: 1260,
    }, "general").sourceDurationSeconds).toBe(1260);
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
