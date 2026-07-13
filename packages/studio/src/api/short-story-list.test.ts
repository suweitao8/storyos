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
  it("lists only completed short stories with title and chapter metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "inkos-short-list-"));
    roots.push(root);
    await mkdir(join(root, "shorts", "mist-harbor", "final"), { recursive: true });
    await writeFile(
      join(root, "shorts", "mist-harbor", "final", "short-story.json"),
      JSON.stringify({ storyTitle: "雾港来信", chapters: [{ wordCount: 1200 }, { wordCount: 800 }] }),
      "utf-8",
    );
    await writeFile(join(root, "shorts", "mist-harbor", "final", "full.md"), "# 第一章\n正文", "utf-8");

    await mkdir(join(root, "shorts", "draft-only", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "draft-only", "outline", "v001.md"), "# 草稿", "utf-8");

    await expect(listStudioShortStories(root)).resolves.toEqual([
      expect.objectContaining({
        id: "mist-harbor",
        title: "雾港来信",
        status: "completed",
        chaptersWritten: 2,
        wordCount: 2000,
      }),
    ]);
  });

  it("falls back to the directory id when a completed artifact has no title", async () => {
    const root = await mkdtemp(join(tmpdir(), "inkos-short-list-"));
    roots.push(root);
    await mkdir(join(root, "shorts", "untitled", "final"), { recursive: true });
    await writeFile(join(root, "shorts", "untitled", "final", "full.md"), "正文", "utf-8");

    await expect(listStudioShortStories(root)).resolves.toEqual([
      expect.objectContaining({ id: "untitled", title: "untitled", chaptersWritten: 1, wordCount: 0 }),
    ]);
  });
});
