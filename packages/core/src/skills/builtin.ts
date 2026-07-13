import {
  CapabilitySkillManifestSchema,
  type CapabilitySkillManifest,
} from "./types.js";

const RAW_BUILTIN_CAPABILITY_SKILLS: CapabilitySkillManifest[] = [
  {
    id: "longform-writing",
    name: "长篇写作",
    description: "长篇连载小说创作：规划章节、选择故事上下文、撰写正文、审计、修订并保持连续性。",
    whenToUse: "用于长篇书籍、章节规划、续写下一章、审计修复、真相/状态一致性维护以及作者意图驱动的写作。",
    triggers: [
      "长篇",
      "章节",
      "下一章",
      "续写",
      "审稿",
      "修稿",
      "伏笔",
      "author intent",
      "chapter",
      "write next",
      "longform",
    ],
    sessionKinds: ["book", "book-create"],
    promptPacks: [
      "longform.writer",
      "longform.reviser",
      "longform.auditor",
    ],
    toolHints: [
      "plan_chapter",
      "compose_chapter",
      "write_draft",
      "write_full_pipeline",
      "audit_chapter",
      "revise_chapter",
    ],
    contextNeeds: [
      {
        id: "author-intent",
        purpose: "Bind long-horizon user intent and prevent model defaults from overriding the book direction.",
        sources: ["story/author_intent.md"],
        tier: "protected",
        appliesTo: ["planner", "composer", "writer", "auditor", "reviser", "chat"],
        retrieval: "full",
      },
      {
        id: "current-focus",
        purpose: "Carry the next-chapter steering and short-horizon focus.",
        sources: ["story/current_focus.md"],
        tier: "protected",
        appliesTo: ["planner", "composer", "writer", "auditor", "reviser", "chat"],
        retrieval: "full",
      },
      {
        id: "chapter-memo",
        purpose: "Carry the planner's chapter-specific memo into writing and review.",
        sources: ["runtime/chapter_memo"],
        tier: "protected",
        appliesTo: ["composer", "writer", "auditor", "reviser"],
        retrieval: "full",
      },
      {
        id: "story-frame",
        purpose: "Preserve world rules, core conflict, tone, and non-negotiable canon anchors relevant to the task.",
        sources: ["story/outline/story_frame.md", "story/story_bible.md"],
        tier: "protected",
        appliesTo: ["planner", "composer", "writer", "auditor", "reviser", "chat"],
        retrieval: "sections",
      },
      {
        id: "volume-map",
        purpose: "Select the current arc/chapter planning section without injecting the entire long outline.",
        sources: ["story/outline/volume_map.md", "story/volume_outline.md"],
        tier: "protected",
        appliesTo: ["composer", "writer", "auditor", "reviser"],
        retrieval: "sections",
      },
      {
        id: "active-hooks",
        purpose: "Preserve active hook evidence and hook debt that the current chapter must honor.",
        sources: ["story/pending_hooks.md", "runtime/hook_debt"],
        tier: "protected",
        appliesTo: ["planner", "composer", "writer", "auditor", "reviser"],
        retrieval: "semantic",
      },
      {
        id: "episodic-memory",
        purpose: "Retrieve older chapter summaries, state facts, and volume summaries that are relevant but may be semantically compressed.",
        sources: ["story/chapter_summaries.md", "story/current_state.md", "story/volume_summaries.md"],
        tier: "compressible",
        appliesTo: ["composer", "writer", "auditor", "reviser"],
        retrieval: "semantic",
      },
    ],
    body: "",
    source: "builtin",
  },
];

export const BUILTIN_CAPABILITY_SKILLS: ReadonlyArray<CapabilitySkillManifest> =
  RAW_BUILTIN_CAPABILITY_SKILLS.map((skill) => CapabilitySkillManifestSchema.parse(skill));
