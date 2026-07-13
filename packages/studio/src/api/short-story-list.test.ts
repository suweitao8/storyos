import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { listStudioShortStories } from "./short-story-list";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("listStudioShortStories", () => {
  it("lists completed short stories with title, summary, and word count", async () => {
    const root = await mkdtemp(join(tmpdir(), "inkos-short-list-"));
    roots.push(root);
    await mkdir(join(root, "shorts", "mist-harbor", "final"), { recursive: true });
    await writeFile(
      join(root, "shorts", "mist-harbor", "final", "short-story.json"),
      JSON.stringify({ storyTitle: "Mist Harbor", chapters: [{ wordCount: 1200 }, { wordCount: 800 }] }),
      "utf-8",
    );
    await writeFile(
      join(root, "shorts", "mist-harbor", "final", "sales-package.json"),
      JSON.stringify({ intro: "An old ledger pulls the protagonist back to an abandoned harbor." }),
      "utf-8",
    );
    await writeFile(join(root, "shorts", "mist-harbor", "final", "full.md"), "# Chapter One\nText", "utf-8");

    await mkdir(join(root, "shorts", "draft-only", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "draft-only", "outline", "v001.md"), "# Draft", "utf-8");

    await expect(listStudioShortStories(root)).resolves.toEqual([
      expect.objectContaining({
        id: "mist-harbor",
        title: "Mist Harbor",
        status: "completed",
        chaptersWritten: 2,
        wordCount: 2000,
        summary: "An old ledger pulls the protagonist back to an abandoned harbor.",
      }),
    ]);
  });

  it("falls back to the directory id when a completed artifact has no title", async () => {
    const root = await mkdtemp(join(tmpdir(), "inkos-short-list-"));
    roots.push(root);
    await mkdir(join(root, "shorts", "untitled", "final"), { recursive: true });
    await writeFile(join(root, "shorts", "untitled", "final", "full.md"), "Text", "utf-8");

    await expect(listStudioShortStories(root)).resolves.toEqual([
      expect.objectContaining({ id: "untitled", title: "untitled", chaptersWritten: 1, wordCount: 4 }),
    ]);
  });

  it("accepts charCount from legacy short-story artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "inkos-short-list-"));
    roots.push(root);
    await mkdir(join(root, "shorts", "legacy", "final"), { recursive: true });
    await writeFile(
      join(root, "shorts", "legacy", "final", "short-story.json"),
      JSON.stringify({ storyTitle: "Legacy Story", chapters: [{ charCount: 900 }] }),
      "utf-8",
    );
    await writeFile(join(root, "shorts", "legacy", "final", "full.md"), "Text", "utf-8");

    await expect(listStudioShortStories(root)).resolves.toEqual([
      expect.objectContaining({ id: "legacy", wordCount: 900 }),
    ]);
  });
});
