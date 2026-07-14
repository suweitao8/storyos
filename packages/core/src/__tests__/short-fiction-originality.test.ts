import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CraftProfile } from "../models/craft-profile.js";
import {
  ShortFictionOutlineAgent,
  ShortFictionPackagingAgent,
  ShortFictionWriterAgent,
  parseShortFictionBatchDraft,
} from "../agents/short-fiction.js";
import { runShortFictionProduction } from "../pipeline/short-fiction-runner.js";

const craftProfile: CraftProfile = {
  sourceName: "reference",
  analyzedAt: "2026-07-14T00:00:00.000Z",
  language: "zh",
  worldview: "REFERENCE_WORLDVIEW_EVENT",
  storyOutline: "REFERENCE_STORY_OUTLINE_EVENT",
  storySeed: {
    title: "新的默认设定",
    genreTone: "悬疑",
    hook: "新的钩子",
    worldview: "新的规则",
    characters: "新的关系",
    conflict: "新的冲突",
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
    sceneTransitionTechnique: "hard cuts",
    pacingCurve: "quiet then danger",
    conflictEscalation: "rising cost",
  },
  informationDisclosure: {
    foreshadowingDensity: "high",
    informationReleaseRhythm: "staged",
    suspenseManagement: "new question after each answer",
  },
  narrativePerspective: {
    povStrategy: "close third",
    narrationDialogueRatio: "balanced",
    narrativeDistance: "close",
  },
  exemplars: [{ label: "source", tone: "tense", excerpt: "REFERENCE_EXEMPLAR_PROSE" }],
};

describe("short-fiction originality wiring", () => {
  let root: string;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("passes a filtered originality guide and no source exemplars to outline and writer", async () => {
    root = await mkdtemp(join(tmpdir(), "inkos-short-originality-"));
    const outline = vi.spyOn(ShortFictionOutlineAgent.prototype, "createOutline").mockResolvedValue({
      storyTitle: "写字楼的空工位",
      rawContent: "## 故事方案\n全新的办公楼因果链。",
    });
    const draft = parseShortFictionBatchDraft([
      "=== SHORT_FICTION_TITLE ===",
      "写字楼的空工位",
      "=== CHAPTER 1 TITLE ===",
      "空工位",
      "=== CHAPTER 1 CONTENT ===",
      "有效场面。".repeat(500),
    ].join("\n"), { expectedChapters: 1 });
    const writer = vi.spyOn(ShortFictionWriterAgent.prototype, "writeDraft").mockResolvedValue(draft);
    vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "写字楼的空工位",
      intro: "原创悬疑",
      sellingPoints: ["新因果链"],
      coverPrompt: "",
      rawContent: "",
    });

    await runShortFictionProduction({
      projectRoot: root,
      direction: "以原创化改编方案创作一篇新短篇",
      runtimes: {
        planner: {} as never,
        outlineReview: {} as never,
        writer: {} as never,
        draftReview: {} as never,
        revise: {} as never,
        package: {} as never,
      },
      craftProfile,
      chapterCount: 1,
      charsPerChapter: 1_000,
      quick: true,
      cover: false,
    });

    const outlineInput = outline.mock.calls[0]?.[0];
    const writerInput = writer.mock.calls[0]?.[0];
    expect(outlineInput?.craftGuide).toContain("NEW_SPACE=OFFICE");
    expect(outlineInput?.craftGuide).not.toContain("REFERENCE_WORLDVIEW_EVENT");
    expect(outlineInput?.craftGuide).not.toContain("REFERENCE_STORY_OUTLINE_EVENT");
    expect(writerInput?.craftGuide).toContain("NEW_SPACE=OFFICE");
    expect(writerInput?.craftExemplars).toBeUndefined();
  });
});
