import { describe, expect, it } from "vitest";
import { buildCraftGuide } from "../agents/craft-prompts.js";
import type { CraftProfile } from "../models/craft-profile.js";

const profile: CraftProfile = {
  sourceName: "现实悬疑拆文",
  analyzedAt: "2026-07-16T00:00:00.000Z",
  language: "zh",
  worldview: "REFERENCE_WORLDVIEW_EVENT",
  storyOutline: "REFERENCE_PLOT_CHAIN",
  structure: { openingPattern: "命案钩子", chapterArc: "调查升级", endingHookType: "证据反转" },
  sceneRhythm: { sceneTransitionTechnique: "线索切换", pacingCurve: "逐步收紧", conflictEscalation: "证据升级" },
  informationDisclosure: { foreshadowingDensity: "高", informationReleaseRhythm: "逐层释放", suspenseManagement: "延迟揭示" },
  narrativePerspective: { povStrategy: "近景第三人称", narrationDialogueRatio: "均衡", narrativeDistance: "近" },
  videoStory: {
    logline: "REFERENCE_VIDEO_LOGLINE",
    audiencePromise: "参考视频承诺：在日常空间中连续升级现实悬疑压力",
    outline: "REFERENCE_VIDEO_OUTLINE",
    beats: [{ order: 1, kind: "hook", position: 0.1, event: "REFERENCE_VIDEO_BEAT_EVENT", function: "先抛出无法忽视的问题", emotionalEffect: "不安" }],
    reversals: [{ order: 1, position: 0.6, trigger: "REFERENCE_VIDEO_TRIGGER", apparentTruth: "REFERENCE_VIDEO_APPARENT_TRUTH", reveal: "REFERENCE_VIDEO_REVEAL", reinterpretedClues: "REFERENCE_VIDEO_CLUES", emotionalEffect: "震惊", setupBeatOrders: [1] }],
    payoffs: [{ order: 1, position: 0.9, setup: "REFERENCE_VIDEO_SETUP", release: "REFERENCE_VIDEO_PAYOFF", costOrConsequence: "REFERENCE_VIDEO_COST", emotionalEffect: "释然" }],
    pacingCurve: "前段迅速抛题，中段连续加压，结尾完成代价释放",
    hookStrategy: "用具体异常立刻抛出悬念",
    climaxStrategy: "通过高代价选择完成真相揭示",
    endingAftertaste: "真相落地后仍留下现实余波",
    originalizationRules: ["重建人物、地点、因果链和结局，只迁移节拍功能。"],
  },
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
    expect(guide).not.toContain("REFERENCE_WORLDVIEW_EVENT");
    expect(guide).not.toContain("REFERENCE_PLOT_CHAIN");
  });

  it("keeps video rhythm but hides reference-video plot details after a story seed is approved", () => {
    const guide = buildCraftGuide(profile);

    expect(guide).toContain("参考视频承诺：在日常空间中连续升级现实悬疑压力");
    expect(guide).toContain("前段迅速抛题，中段连续加压，结尾完成代价释放");
    expect(guide).toContain("用具体异常立刻抛出悬念");
    expect(guide).toContain("重建人物、地点、因果链和结局，只迁移节拍功能。");
    expect(guide).not.toContain("REFERENCE_VIDEO_LOGLINE");
    expect(guide).not.toContain("REFERENCE_VIDEO_OUTLINE");
    expect(guide).not.toContain("REFERENCE_VIDEO_BEAT_EVENT");
    expect(guide).not.toContain("REFERENCE_VIDEO_TRIGGER");
    expect(guide).not.toContain("REFERENCE_VIDEO_APPARENT_TRUTH");
    expect(guide).not.toContain("REFERENCE_VIDEO_REVEAL");
    expect(guide).not.toContain("REFERENCE_VIDEO_CLUES");
    expect(guide).not.toContain("REFERENCE_VIDEO_SETUP");
    expect(guide).not.toContain("REFERENCE_VIDEO_PAYOFF");
    expect(guide).not.toContain("REFERENCE_VIDEO_COST");
  });
});
