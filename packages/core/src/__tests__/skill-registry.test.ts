import { describe, expect, it } from "vitest";
import {
  createSkillRegistry,
  BUILTIN_CAPABILITY_SKILLS,
} from "../skills/index.js";

describe("capability skill registry", () => {
  it("ships the built-in longform writing skill with context needs", () => {
    const registry = createSkillRegistry();
    const ids = registry.listSkills().map((skill) => skill.id).sort();

    expect(ids).toEqual(["longform-writing"]);
    for (const skill of registry.listSkills()) {
      expect(skill.contextNeeds.length).toBeGreaterThan(0);
    }
  });

  it("resolves forced skills even when the instruction would not auto-select them", () => {
    const registry = createSkillRegistry();

    const result = registry.resolveSkills({
      requestedSkills: ["longform-writing"],
      sessionKind: "chat",
      instruction: "随便聊聊这个故事标题",
    });

    expect(result.usedSkills.map((skill) => skill.id)).toEqual(["longform-writing"]);
    expect(result.forcedSkillIds).toEqual(["longform-writing"]);
    expect(result.missingSkillIds).toEqual([]);
  });

  it("reports unknown forced skills instead of silently dropping them", () => {
    const registry = createSkillRegistry();

    const result = registry.resolveSkills({
      requestedSkills: ["not-a-skill", "longform-writing"],
      instruction: "继续写下一章",
    });

    expect(result.usedSkills.map((skill) => skill.id)).toEqual(["longform-writing"]);
    expect(result.missingSkillIds).toEqual(["not-a-skill"]);
  });

  it("excludes disabled skills from automatic selection", () => {
    const registry = createSkillRegistry();

    const result = registry.resolveSkills({
      disabledSkills: ["longform-writing"],
      instruction: "继续写下一章，注意伏笔一致性",
    });

    expect(result.autoSkillIds).not.toContain("longform-writing");
    expect(result.usedSkills.map((skill) => skill.id)).not.toContain("longform-writing");
    expect(result.disabledSkillIds).toEqual(["longform-writing"]);
  });

  it("auto-selects skill candidates from session kind and natural-language instruction", () => {
    const registry = createSkillRegistry();

    expect(registry.resolveSkills({
      sessionKind: "book",
      instruction: "继续写下一章，注意伏笔一致性",
    }).usedSkills.map((skill) => skill.id)).toEqual(["longform-writing"]);
  });

  it("keeps built-in manifests schema-valid at module load time", () => {
    expect(BUILTIN_CAPABILITY_SKILLS).toHaveLength(1);
  });
});
