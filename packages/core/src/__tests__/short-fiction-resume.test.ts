import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ShortFictionOutlineAgent,
  ShortFictionOutlineReviewerAgent,
  ShortFictionOutlineReviserAgent,
  ShortFictionWriterAgent,
  ShortFictionDraftReviewerAgent,
  ShortFictionDraftReviserAgent,
  ShortFictionPackagingAgent,
  parseShortFictionBatchDraft,
} from "../agents/short-fiction.js";
import { runShortFictionProduction } from "../pipeline/short-fiction-runner.js";
import type { CraftProfile } from "../models/craft-profile.js";

const CH = 12;
const DRAFT_MD = `
=== SHORT_FICTION_TITLE ===
电梯多一层
${Array.from({ length: CH }, (_, i) => `=== CHAPTER ${i + 1} TITLE ===
第${i + 1}章
=== CHAPTER ${i + 1} CONTENT ===
${"深夜的电梯停在不存在的十三层，门开了。".repeat(50)}`).join("\n")}
`;
const PARTIAL_DRAFT_MD = `
=== SHORT_FICTION_TITLE ===
电梯多一层
${Array.from({ length: 5 }, (_, i) => `=== CHAPTER ${i + 1} TITLE ===
第${i + 1}章
=== CHAPTER ${i + 1} CONTENT ===
${"深夜的电梯停在不存在的十三层，门开了。".repeat(50)}`).join("\n")}
`;
const MIDDLE_GAP_DRAFT_MD = `
=== SHORT_FICTION_TITLE ===
电梯多一层
${Array.from({ length: CH }, (_, i) => `=== CHAPTER ${i + 1} TITLE ===
第${i + 1}章
=== CHAPTER ${i + 1} CONTENT ===
${i === 4 || i === 7 ? "" : "深夜的电梯停在不存在的十三层，门开了。".repeat(50)}`).join("\n")}
`;
const CHAPTER_5_ONLY_CONTINUATION_MD = `
=== CHAPTER 5 TITLE ===
第5章
=== CHAPTER 5 CONTENT ===
${"第五章补写完成，电梯井里传来旧广播声。".repeat(50)}
`;
const SHORT_DRAFT_MD = `
=== SHORT_FICTION_TITLE ===
电梯多一层
${Array.from({ length: CH }, (_, i) => `=== CHAPTER ${i + 1} TITLE ===
第${i + 1}章
=== CHAPTER ${i + 1} CONTENT ===
短正文`).join("\n")}
`;

function ctx(projectRoot: string) {
  return { client: { provider: "openai" } as never, model: "fake", projectRoot };
}
function runtimes(projectRoot: string) {
  const c = ctx(projectRoot);
  return { planner: c, outlineReview: c, writer: c, draftReview: c, revise: c, package: c };
}

const realisticCraft: CraftProfile = {
  sourceName: "realistic suspense reference",
  analyzedAt: "2026-07-16T00:00:00.000Z",
  language: "zh",
  worldview: "\u73b0\u4ee3\u57ce\u5e02\u7684\u8d22\u52a1\u72af\u7f6a\u4e0e\u4eba\u9645\u5173\u7cfb\u538b\u529b\u3002",
  storyOutline: "\u76ee\u51fb\u8bc1\u4eba\u901a\u8fc7\u8bc1\u636e\u4e0e\u52a8\u673a\u8ffd\u67e5\u771f\u76f8\u3002",
  structure: { openingPattern: "hook", chapterArc: "pressure", endingHookType: "cost" },
  sceneRhythm: { sceneTransitionTechnique: "cuts", pacingCurve: "rising", conflictEscalation: "rising cost" },
  informationDisclosure: { foreshadowingDensity: "high", informationReleaseRhythm: "staged", suspenseManagement: "questions" },
  narrativePerspective: { povStrategy: "close third", narrationDialogueRatio: "balanced", narrativeDistance: "close" },
  exemplars: [],
};

describe("short fiction resume + failure marker (C2)", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "storyos-shortc2-")); });
  afterEach(async () => { vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); });

  function stubDownstream() {
    const draft = parseShortFictionBatchDraft(DRAFT_MD, { expectedChapters: CH });
    vi.spyOn(ShortFictionWriterAgent.prototype, "writeDraft").mockResolvedValue(draft);
    vi.spyOn(ShortFictionDraftReviewerAgent.prototype, "reviewDraft").mockResolvedValue("looks fine");
    vi.spyOn(ShortFictionDraftReviserAgent.prototype, "reviseDraft").mockResolvedValue(draft);
    vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "电梯多一层", intro: "钩子", sellingPoints: ["反转"], coverPrompt: "", rawContent: "",
    });
  }

  it("uses a later non-empty duplicate chapter content block when filling a previously empty chapter", () => {
    const merged = `${MIDDLE_GAP_DRAFT_MD}\n\n${CHAPTER_5_ONLY_CONTINUATION_MD}`;
    const draft = parseShortFictionBatchDraft(merged, { expectedChapters: CH });

    expect(draft.chapters[4]?.content).toContain("第五章补写完成");
    expect(findEmptyChapterNumbers(draft)).toEqual([8]);
  });

  it("resumes from an existing outline/v002.md, skipping the three outline stages", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲\n12章完整方案", "utf-8");

    const createOutline = vi.spyOn(ShortFictionOutlineAgent.prototype, "createOutline");
    const reviewOutline = vi.spyOn(ShortFictionOutlineReviewerAgent.prototype, "reviewOutline");
    stubDownstream();

    const result = await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    expect(createOutline).not.toHaveBeenCalled();   // outline resumed from disk
    expect(reviewOutline).not.toHaveBeenCalled();
    await expect(access(join(root, "shorts", "elevator", "final", "full.md"))).resolves.toBeUndefined();
    await expect(readFile(join(root, "shorts", "elevator", "status.json"), "utf-8"))
      .resolves.toContain('"status": "complete"');
    expect(result.storyId).toBe("elevator");
  });

  it("writes a failure marker (status.json) when a stage throws, instead of orphaning a silent partial", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    // Writer stage fails with a transient-style upstream error.
    vi.spyOn(ShortFictionWriterAgent.prototype, "writeDraft").mockRejectedValue(new Error("503 temporarily unavailable"));

    await expect(runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    })).rejects.toThrow(/503/);

    const status = JSON.parse(await readFile(join(root, "shorts", "elevator", "status.json"), "utf-8"));
    expect(status.status).toBe("failed");
    expect(status.error).toContain("503");
  });

  it("rejects a realistic writing mode draft that introduces a science-fiction mechanism", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## existing outline", "utf-8");
    const driftingDraft = parseShortFictionBatchDraft(
      `${DRAFT_MD}\n\u5acc\u7591\u4eba\u624d\u53d1\u73b0\uff0c\u51f6\u624b\u662f\u6765\u81ea\u672a\u6765\u7684\u4eba\u5de5\u667a\u80fd\u3002`,
      { expectedChapters: CH },
    );
    vi.spyOn(ShortFictionWriterAgent.prototype, "writeDraft").mockResolvedValue(driftingDraft);
    const packageStory = vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "realistic story", intro: "hook", sellingPoints: ["payoff"], coverPrompt: "", rawContent: "",
    });

    await expect(runShortFictionProduction({
      projectRoot: root, direction: "\u73b0\u5b9e\u60ac\u7591\u77ed\u7bc7", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, quick: true,
      craftProfile: realisticCraft, runtimes: runtimes(root),
    })).rejects.toThrow(/reality-level lock/i);

    expect(packageStory).not.toHaveBeenCalled();
    const status = JSON.parse(await readFile(join(root, "shorts", "elevator", "status.json"), "utf-8"));
    expect(status.status).toBe("failed");
  });

  it("continues a truncated first draft before review instead of reviewing empty chapters", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    const partial = parseShortFictionBatchDraft(PARTIAL_DRAFT_MD, { expectedChapters: CH });
    const complete = parseShortFictionBatchDraft(DRAFT_MD, { expectedChapters: CH });
    const continueDraft = vi.spyOn(ShortFictionWriterAgent.prototype, "continueDraft").mockResolvedValue(complete);
    vi.spyOn(ShortFictionWriterAgent.prototype, "writeDraft").mockResolvedValue(partial);
    vi.spyOn(ShortFictionDraftReviewerAgent.prototype, "reviewDraft").mockResolvedValue("looks fine");
    vi.spyOn(ShortFictionDraftReviserAgent.prototype, "reviseDraft").mockResolvedValue(complete);
    vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "电梯多一层", intro: "钩子", sellingPoints: ["反转"], coverPrompt: "", rawContent: "",
    });

    await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    expect(continueDraft).toHaveBeenCalled();
    await expect(access(join(root, "shorts", "elevator", "drafts", "v001-partial", "full.md"))).resolves.toBeUndefined();
    const final = await readFile(join(root, "shorts", "elevator", "final", "full.md"), "utf-8");
    expect(final).toContain("第12章");
  });

  it("rejects a non-empty short draft without forcing a continuation", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    const initial = parseShortFictionBatchDraft(SHORT_DRAFT_MD, { expectedChapters: CH });
    const complete = parseShortFictionBatchDraft(DRAFT_MD, { expectedChapters: CH });
    const continueDraft = vi.spyOn(ShortFictionWriterAgent.prototype, "continueDraft").mockResolvedValue(complete);
    vi.spyOn(ShortFictionWriterAgent.prototype, "writeDraft").mockResolvedValue(initial);
    vi.spyOn(ShortFictionDraftReviewerAgent.prototype, "reviewDraft").mockResolvedValue("looks fine");
    vi.spyOn(ShortFictionDraftReviserAgent.prototype, "reviseDraft").mockResolvedValue(complete);
    vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "电梯多一层", intro: "钩子", sellingPoints: ["反转"], coverPrompt: "", rawContent: "",
    });

    await expect(runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    })).rejects.toThrow(/too short/);

    expect(continueDraft).not.toHaveBeenCalled();
  });

  it("keeps completing a draft when the first continuation fills only some missing middle chapters", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    const initial = parseShortFictionBatchDraft(MIDDLE_GAP_DRAFT_MD, { expectedChapters: CH });
    const chapter5Only = parseShortFictionBatchDraft(`${MIDDLE_GAP_DRAFT_MD}\n\n${CHAPTER_5_ONLY_CONTINUATION_MD}`, { expectedChapters: CH });
    const complete = parseShortFictionBatchDraft(DRAFT_MD, { expectedChapters: CH });
    const continueDraft = vi.spyOn(ShortFictionWriterAgent.prototype, "continueDraft")
      .mockResolvedValueOnce(chapter5Only)
      .mockResolvedValueOnce(complete);
    vi.spyOn(ShortFictionWriterAgent.prototype, "writeDraft").mockResolvedValue(initial);
    vi.spyOn(ShortFictionDraftReviewerAgent.prototype, "reviewDraft").mockResolvedValue("looks fine");
    vi.spyOn(ShortFictionDraftReviserAgent.prototype, "reviseDraft").mockResolvedValue(complete);
    vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "电梯多一层", intro: "钩子", sellingPoints: ["反转"], coverPrompt: "", rawContent: "",
    });

    await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    expect(continueDraft).toHaveBeenCalledTimes(2);
    const finalJson = JSON.parse(await readFile(join(root, "shorts", "elevator", "final", "short-story.json"), "utf-8"));
    expect(finalJson.chapters.every((chapter: { content: string }) => chapter.content.length > 0)).toBe(true);
  });

  it("keeps the complete first draft when the single revision output is invalid", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    const complete = parseShortFictionBatchDraft(DRAFT_MD, { expectedChapters: CH });
    const invalidRevision = parseShortFictionBatchDraft("=== SHORT_FICTION_TITLE ===\n空改稿", { expectedChapters: CH });
    vi.spyOn(ShortFictionWriterAgent.prototype, "writeDraft").mockResolvedValue(complete);
    vi.spyOn(ShortFictionDraftReviewerAgent.prototype, "reviewDraft").mockResolvedValue("looks fine");
    vi.spyOn(ShortFictionDraftReviserAgent.prototype, "reviseDraft").mockResolvedValue(invalidRevision);
    vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "电梯多一层", intro: "钩子", sellingPoints: ["反转"], coverPrompt: "", rawContent: "",
    });

    await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    const warning = await readFile(join(root, "shorts", "elevator", "reviews", "draft-v002-warning.md"), "utf-8");
    expect(warning).toContain("第二轮改稿未采用");
    const status = JSON.parse(await readFile(join(root, "shorts", "elevator", "status.json"), "utf-8"));
    expect(status).toMatchObject({
      status: "complete",
      stage: "packaged",
      generationMode: "reviewed",
      draftRevision: "kept-first-draft",
    });
    const finalJson = JSON.parse(await readFile(join(root, "shorts", "elevator", "final", "short-story.json"), "utf-8"));
    expect(finalJson.chapters.every((chapter: { content: string }) => chapter.content.length > 0)).toBe(true);
  });

  it("returns the existing short untouched when final/full.md already exists (idempotent)", async () => {
    await mkdir(join(root, "shorts", "elevator", "final"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "final", "full.md"), "# done", "utf-8");
    const writeDraft = vi.spyOn(ShortFictionWriterAgent.prototype, "writeDraft");

    const result = await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    expect(writeDraft).not.toHaveBeenCalled();       // nothing regenerated
    expect(result.coverError).toBe("already-complete");
  });

  it("does not treat a completed artifact below the requested length as complete", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await mkdir(join(root, "shorts", "elevator", "final"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    await writeFile(join(root, "shorts", "elevator", "final", "full.md"), "# partial", "utf-8");
    await writeFile(join(root, "shorts", "elevator", "final", "short-story.json"), JSON.stringify({
      storyTitle: "电梯多一层",
      chapters: [{ number: 1, title: "第一章", content: "短正文", charCount: 3 }],
    }), "utf-8");
    stubDownstream();

    const result = await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    expect(result.coverError).not.toBe("already-complete");
  });

  it("does not skip a previously failed run just because final/full.md exists", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await mkdir(join(root, "shorts", "elevator", "final"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    await writeFile(join(root, "shorts", "elevator", "final", "full.md"), "# partial final", "utf-8");
    await writeFile(join(root, "shorts", "elevator", "status.json"), JSON.stringify({ status: "failed", error: "package failed" }), "utf-8");
    stubDownstream();
    const packageSpy = vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage");

    const result = await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    expect(result.coverImagePath).toBe("shorts/elevator/final/cover.svg");
    expect(result.coverError).toBeUndefined();
    expect(packageSpy).toHaveBeenCalled();
    await expect(access(join(root, "shorts", "elevator", "final", "sales-package.md"))).resolves.toBeUndefined();
  });

  it("clears a failed run marker after a successful retry so the next run reuses the finished artifacts", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await mkdir(join(root, "shorts", "elevator", "final"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    await writeFile(join(root, "shorts", "elevator", "final", "full.md"), "# partial final", "utf-8");
    await writeFile(join(root, "shorts", "elevator", "status.json"), JSON.stringify({ status: "failed", error: "package failed" }), "utf-8");
    stubDownstream();
    const writeDraft = vi.spyOn(ShortFictionWriterAgent.prototype, "writeDraft");

    await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    const status = JSON.parse(await readFile(join(root, "shorts", "elevator", "status.json"), "utf-8"));
    expect(status).toMatchObject({ status: "complete", stage: "packaged" });
    writeDraft.mockClear();

    const replay = await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    expect(writeDraft).not.toHaveBeenCalled();
    expect(replay.coverError).toBe("already-complete");
  });
});

function findEmptyChapterNumbers(draft: ReturnType<typeof parseShortFictionBatchDraft>): number[] {
  return draft.chapters.filter((chapter) => !chapter.content.trim()).map((chapter) => chapter.number);
}
