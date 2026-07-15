import { describe, expect, it } from "vitest";
import { buildCraftGuide } from "../agents/craft-prompts.js";
import type { CraftProfile } from "../models/craft-profile.js";

const profile: CraftProfile = {
  sourceName: "现实悬疑拆文",
  analyzedAt: "2026-07-16T00:00:00.000Z",
  language: "zh",
  worldview: "现实都市中的案件必须有可验证的解释。",
  storyOutline: "从命案线索进入调查，在证词反转中收束。",
  structure: { openingPattern: "命案钩子", chapterArc: "调查升级", endingHookType: "证据反转" },
  sceneRhythm: { sceneTransitionTechnique: "线索切换", pacingCurve: "逐步收紧", conflictEscalation: "证据升级" },
  informationDisclosure: { foreshadowingDensity: "高", informationReleaseRhythm: "逐层释放", suspenseManagement: "延迟揭示" },
  narrativePerspective: { povStrategy: "近景第三人称", narrationDialogueRatio: "均衡", narrativeDistance: "近" },
  exemplars: [],
  storySeed: {
    title: "失物招领处的录音",
    genreTone: "现实都市悬疑",
    hook: "失物招领处收到一段尚未发生的报警录音。",
    worldview: "所有异常都必须通过人、物证与信息差得到现实解释。",
    characters: "档案员与失踪者姐姐共同调查。",
    conflict: "每次公开线索都会让关键证人失联。",
    outline: "从录音来源开始，穿过证词矛盾，最后在旧仓库完成证据反转。",
    reversals: "录音不是预言，而是犯罪者伪造的诱导。",
    ending: "主角公布证据，也承担泄露隐私的代价。",
    visualAudioMotifs: "旧磁带、雨夜电话亭、地铁广播。",
    originalizationPlan: "保留调查节奏，重建人物、地点、犯罪动机与证据链。",
  },
};

describe("long-form craft story seed contract", () => {
  it("makes the approved story seed a hard foundation input", () => {
    const guide = buildCraftGuide(profile);

    expect(guide).toContain("## 已确认的原创故事设定（建书时必须遵守）");
    expect(guide).toContain("失物招领处的录音");
    expect(guide).toContain("所有异常都必须通过人、物证与信息差得到现实解释");
    expect(guide).toContain("保留调查节奏，重建人物、地点、犯罪动机与证据链");
  });
});
