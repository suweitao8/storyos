import { describe, expect, it } from "vitest";
import { buildStoryDirectionPrompt, buildStorySeedPrompt } from "../agents/craft-prompts.js";
import type { CraftProfile } from "../models/craft-profile.js";

const profile: CraftProfile = {
  sourceName: "reference",
  analyzedAt: "2026-07-13T00:00:00.000Z",
  language: "zh",
  worldview: "A closed residential block treats repeated sounds as warnings and records disappear after midnight.",
  storyOutline: "A protagonist notices a small rule violation, investigates missing records, faces escalating proof, and pays a personal cost to expose the hidden mechanism.",
  structure: {
    openingPattern: "an abnormal detail in an ordinary routine",
    chapterArc: "clue, pressure, reversal, consequence",
    endingHookType: "a new rule appears after the apparent resolution",
  },
  sceneRhythm: {
    sceneTransitionTechnique: "hard cuts after a new clue",
    pacingCurve: "quiet observation followed by compressed danger",
    conflictEscalation: "each answer creates a more personal cost",
  },
  informationDisclosure: {
    foreshadowingDensity: "high",
    informationReleaseRhythm: "staged reveals",
    suspenseManagement: "withhold the rule behind repeated evidence",
  },
  narrativePerspective: {
    povStrategy: "close third person",
    narrationDialogueRatio: "balanced",
    narrativeDistance: "close to the protagonist",
  },
  exemplars: [],
};

describe("story direction prompt", () => {
  it("uses the craft worldview and outline while asking for an original direction", () => {
    const prompt = buildStoryDirectionPrompt(profile, "short", "zh", "old direction");

    expect(prompt.system).toContain("new identities");
    expect(prompt.user).toContain(profile.worldview);
    expect(prompt.user).toContain(profile.storyOutline);
    expect(prompt.user).toContain("old direction");
    expect(prompt.user).toContain("one-chapter short story");
  });

  it("requests a complete editable short-story seed without thinking output", () => {
    const prompt = buildStorySeedPrompt(profile, "short", "zh");

    for (const section of [
      "故事名称",
      "类型与基调",
      "一句话故事钩子",
      "世界观与运行规则",
      "角色与关系",
      "核心冲突、代价与 stakes",
      "分段故事大纲",
      "关键反转与线索回收",
      "结局与情绪余味",
      "画面与声音母题",
    ]) {
      expect(prompt.user).toContain(section);
    }
    expect(prompt.user).toContain(profile.worldview);
    expect(prompt.user).toContain(profile.storyOutline);
    expect(prompt.system).toContain("Do not output <think>");
    expect(prompt.system).toContain("only the ten Markdown sections");
  });

  it("can build a direct-output seed prompt without a selected craft", () => {
    const prompt = buildStorySeedPrompt(undefined, "short", "en");

    expect(prompt.user).toContain("Story title");
    expect(prompt.user).toContain("one-chapter short story");
    expect(prompt.user).toContain("No craft reference is selected");
  });
});
