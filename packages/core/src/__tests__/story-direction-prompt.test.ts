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
  it("injects worldview and story outline as reference", () => {
    const prompt = buildStoryDirectionPrompt(profile, "short", "zh", "old direction");

    expect(prompt.user).toContain(profile.worldview);
    expect(prompt.user).toContain(profile.storyOutline);
    expect(prompt.user).toContain("old direction");
    expect(prompt.user).toContain("一篇单章节短篇故事");
  });

  it("does NOT inject technical craft mechanics (pacing, POV, rhythm)", () => {
    const prompt = buildStoryDirectionPrompt(profile, "short", "zh");

    // Technical jargon from the craft profile must not leak into the prompt
    expect(prompt.user).not.toContain("openingPattern");
    expect(prompt.user).not.toContain("pacingCurve");
    expect(prompt.user).not.toContain("povStrategy");
    expect(prompt.user).not.toContain("narrativeDistance");
  });

  it("asks for plain, conversational language", () => {
    const directionPrompt = buildStoryDirectionPrompt(profile, "short", "zh");
    const seedPrompt = buildStorySeedPrompt(profile, "short", "zh");

    // The system prompt should encourage natural storytelling, not analysis
    expect(directionPrompt.system).toContain("朋友");
    expect(seedPrompt.system).toContain("朋友");
  });

  it("requests only three sections: title, worldview, outline", () => {
    const prompt = buildStorySeedPrompt(profile, "short", "zh");

    for (const section of [
      "故事名称",
      "世界观与运行规则",
      "分段故事大纲",
    ]) {
      expect(prompt.user).toContain(section);
    }
    // The originality plan section should NOT be requested anymore
    expect(prompt.user).not.toContain("原创要点");
    expect(prompt.user).not.toContain("原创化改编方案");
  });

  it("forbids thinking and analysis output", () => {
    const prompt = buildStorySeedPrompt(profile, "short", "zh");

    expect(prompt.system).toContain("Do not output <think>");
  });

  it("can build a direct-output seed prompt without a selected craft", () => {
    const prompt = buildStorySeedPrompt(undefined, "short", "en");

    expect(prompt.user).toContain("Story title");
    expect(prompt.user).toContain("short story seed");
  });

  it("keeps the framework but swaps specific elements", () => {
    const prompt = buildStorySeedPrompt(profile, "short", "zh");

    expect(prompt.system).toContain("同框架");
    expect(prompt.system).toContain("替换");
  });
});
