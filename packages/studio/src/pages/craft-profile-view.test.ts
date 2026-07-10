import { describe, expect, it } from "vitest";
import { buildCraftDetailModel, craftModuleCategoryLabel } from "./CraftManager";

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
    expect(detail.modules[0]?.label).toBe("开篇钩子");
    expect(detail.modules.some((item) => item.label.includes("悬念"))).toBe(true);
  });
});
