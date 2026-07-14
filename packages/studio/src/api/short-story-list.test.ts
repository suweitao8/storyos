import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getShortStoryDeletedAt,
  listStudioShortStories,
  restoreShortStory,
  softDeleteShortStory,
} from "./short-story-list.js";

const roots: string[] = [];

async function createShortStoryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "storyos-short-trash-"));
  roots.push(root);
  await mkdir(join(root, "shorts", "sample", "final"), { recursive: true });
  await writeFile(join(root, "shorts", "sample", "final", "full.md"), "故事正文", "utf-8");
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("short story trash lifecycle", () => {
  it("lists a deleted short story last, restores it, and exposes its marker", async () => {
    const root = await createShortStoryRoot();
    await softDeleteShortStory(root, "sample", "2026-07-14T00:00:00.000Z");

    const deleted = await listStudioShortStories(root);
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatchObject({ id: "sample", deletedAt: "2026-07-14T00:00:00.000Z" });
    expect(await getShortStoryDeletedAt(root, "sample")).toBe("2026-07-14T00:00:00.000Z");

    await restoreShortStory(root, "sample");
    expect(await getShortStoryDeletedAt(root, "sample")).toBeUndefined();
    expect(await listStudioShortStories(root)).toMatchObject([{ id: "sample" }]);
  });

  it("purges a short story when its 72-hour trash window has elapsed", async () => {
    const root = await createShortStoryRoot();
    await softDeleteShortStory(root, "sample", new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString());

    expect(await listStudioShortStories(root)).toEqual([]);
    await expect(readFile(join(root, "shorts", "sample", "final", "full.md"), "utf-8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
