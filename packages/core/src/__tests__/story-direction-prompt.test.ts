import { describe, expect, it } from "vitest";
import { buildStoryDirectionPrompt } from "../agents/craft-prompts.js";
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
});
