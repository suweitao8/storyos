import { describe, expect, it } from "vitest";
import { buildShortFictionCraftGuide } from "../agents/craft-prompts.js";
import type { CraftProfile } from "../models/craft-profile.js";
import {
  buildShortFictionDraftReviewUserPrompt,
  buildShortFictionOutlineUserPrompt,
  buildShortFictionOutlineReviewUserPrompt,
  buildShortFictionWriterUserPrompt,
} from "../prompts/short-fiction.js";

const filteredProfile: CraftProfile = {
  sourceName: "reference",
  analyzedAt: "2026-07-14T00:00:00.000Z",
  language: "zh",
  worldview: "REFERENCE_WORLDVIEW_EVENT",
  storyOutline: "REFERENCE_STORY_OUTLINE_EVENT",
  storySeed: {
    title: "新的默认设定",
    genreTone: "悬疑",
    hook: "新的钩子",
    worldview: "新的世界规则",
    characters: "新的角色关系",
    conflict: "新的核心冲突",
    outline: "新的推进",
    reversals: "新的反转",
    ending: "新的结局",
    visualAudioMotifs: "新的母题",
    originalizationPlan: "NEW_SPACE=OFFICE; REBUILD_CAUSAL_CHAIN",
  },
  structure: {
    openingPattern: "immediate anomaly",
    chapterArc: "pressure then reversal",
    endingHookType: "new question",
  },
  sceneRhythm: {
    sceneTransitionTechnique: "hard cuts after discoveries",
    pacingCurve: "quiet then compressed danger",
    conflictEscalation: "each answer raises the cost",
  },
  informationDisclosure: {
    foreshadowingDensity: "high",
    informationReleaseRhythm: "staged reveals",
    suspenseManagement: "answer one question and create another",
  },
  narrativePerspective: {
    povStrategy: "close third person",
    narrationDialogueRatio: "balanced",
    narrativeDistance: "close",
  },
  videoStory: {
    logline: "REFERENCE_VIDEO_LOGLINE",
    audiencePromise: "fast mystery",
    outline: "REFERENCE_VIDEO_OUTLINE",
    beats: [{
      order: 1,
      kind: "hook",
      position: 0.1,
      event: "REFERENCE_BEAT_EVENT",
      function: "create a question",
      emotionalEffect: "unease",
    }],
    reversals: [{
      order: 1,
      position: 0.6,
      trigger: "new evidence",
      apparentTruth: "the obvious answer",
      reveal: "REFERENCE_REVEAL",
      reinterpretedClues: "earlier clue",
      emotionalEffect: "shock",
      setupBeatOrders: [1],
    }],
    payoffs: [{
      order: 1,
      position: 0.9,
      setup: "earlier setup",
      release: "REFERENCE_PAYOFF",
      costOrConsequence: "a cost",
      emotionalEffect: "catharsis",
    }],
    pacingCurve: "10% hook, 60% reversal, 90% consequence",
    hookStrategy: "open on a concrete anomaly",
    climaxStrategy: "resolve through a costly choice",
    endingAftertaste: "the mechanism remains active",
    originalizationRules: ["Replace setting, identities, causal chain, and ending."],
  },
  exemplars: [{
    label: "copy",
    tone: "tense",
    excerpt: "REFERENCE_EXEMPLAR_PROSE",
  }],
};

describe("short-fiction writer craft prompt", () => {
  const prompt = buildShortFictionWriterUserPrompt({
    direction: "悬疑短篇 旧书店失踪案 反转",
    outlineMarkdown: "## 大纲\n第1章 入局",
    chapterCount: 12,
    charsPerChapter: 1000,
  });

  it("tells the writer to play out the climax as a scene, not summarize it (B3)", () => {
    expect(prompt).toContain("高潮即场景");
    expect(prompt).toContain("不要梗概"); // already-present discipline still holds
  });

  it("restrains simile over-reliance (B2)", () => {
    expect(prompt).toContain("明喻节制");
  });

  it("frames length as a first-pass planning target instead of a continuation task", () => {
    expect(prompt).toContain("写作前先按目标字数规划场景和节奏");
    expect(prompt).toContain("一次写完整");
    expect(prompt).toContain("85% 到 115%");
    expect(prompt).not.toContain("低于目标字数");
  });

  it("turns outline and draft review into actionable quality gates", () => {
    const outlineReview = buildShortFictionOutlineReviewUserPrompt({
      direction: "现实悬疑短篇",
      outline: { rawContent: "完整大纲" },
      craftGuide: "MODE_CONTRACT",
    });
    const draftReview = buildShortFictionDraftReviewUserPrompt({
      direction: "现实悬疑短篇",
      outlineMarkdown: "完整大纲",
      draftMarkdown: "完整正文",
      chapterCount: 1,
      charsPerChapter: 5000,
      craftGuide: "MODE_CONTRACT",
    });

    expect(outlineReview).toContain("MODE_CONTRACT");
    expect(outlineReview).toContain("必须修复的问题");
    expect(draftReview).toContain("模式一致性");
    expect(draftReview).toContain("可执行修改清单");
  });
});

describe("short-fiction originality craft guide", () => {
  it("keeps short-fiction craft input abstract and originality-first", () => {
    const guide = buildShortFictionCraftGuide(filteredProfile);

    expect(guide).toContain("NEW_SPACE=OFFICE");
    expect(guide).toContain("create a question");
    expect(guide).not.toContain("REFERENCE_WORLDVIEW_EVENT");
    expect(guide).not.toContain("REFERENCE_STORY_OUTLINE_EVENT");
    expect(guide).not.toContain("REFERENCE_VIDEO_LOGLINE");
    expect(guide).not.toContain("REFERENCE_VIDEO_OUTLINE");
    expect(guide).not.toContain("REFERENCE_BEAT_EVENT");
    expect(guide).not.toContain("REFERENCE_REVEAL");
    expect(guide).not.toContain("REFERENCE_PAYOFF");
    expect(guide).not.toContain("REFERENCE_EXEMPLAR_PROSE");
  });

  it("passes the filtered craft guide to the English outline prompt", () => {
    const prompt = buildShortFictionOutlineUserPrompt({
      direction: "An office mystery with a new causal chain",
      chapterCount: 1,
      charsPerChapter: 650,
      craftGuide: "ORIGINALITY_GUIDE",
    }, "en");

    expect(prompt).toContain("ORIGINALITY_GUIDE");
  });
});
