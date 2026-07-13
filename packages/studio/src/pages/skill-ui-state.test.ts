import { describe, expect, it } from "vitest";
import {
  createEmptySkillDraft,
  selectedSkillIdsForSend,
  skillDraftToPayload,
  toggleSelectedSkillIds,
} from "./skill-ui-state";

describe("skill-ui-state", () => {
  it("toggles selected skill ids with normalization", () => {
    expect(toggleSelectedSkillIds([], "Longform Writing")).toEqual(["longform-writing"]);
    expect(toggleSelectedSkillIds(["longform-writing"], "longform-writing")).toEqual([]);
    expect(toggleSelectedSkillIds(["longform-writing"], "  Script@Skill  ")).toEqual([
      "longform-writing",
      "script-skill",
    ]);
  });

  it("returns undefined when no skills should be sent", () => {
    expect(selectedSkillIdsForSend([])).toBeUndefined();
    expect(selectedSkillIdsForSend(["", "   "])).toBeUndefined();
  });

  it("deduplicates selected skill ids for send", () => {
    expect(selectedSkillIdsForSend(["longform-writing", "Longform Writing", "script"])).toEqual([
      "longform-writing",
      "script",
    ]);
  });

  it("serializes skill form values for the API", () => {
    const draft = {
      ...createEmptySkillDraft(),
      id: "Romance Play",
      name: "恋爱互动",
      description: "恋爱本协作",
      whenToUse: "用户要玩恋爱互动世界时",
      triggers: "恋爱, 心动\n约会",
      sessionKinds: "play, chat",
      promptPacks: "play.renderer, play.image",
      body: "保持细腻对话。",
    };

    expect(skillDraftToPayload(draft)).toEqual({
      id: "romance-play",
      name: "恋爱互动",
      description: "恋爱本协作",
      whenToUse: "用户要玩恋爱互动世界时",
      triggers: ["恋爱", "心动", "约会"],
      sessionKinds: ["play", "chat"],
      promptPacks: ["play.renderer", "play.image"],
      body: "保持细腻对话。",
    });
  });
});
