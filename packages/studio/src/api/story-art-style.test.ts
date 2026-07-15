import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { setRecentCraftId } from "./studio-preferences-db.js";
import { resolveStoryArtStyle, resolveStoryCraftId } from "./story-art-style.js";

describe("resolveStoryArtStyle", () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    root = undefined;
  });

  it("uses the recent craft style for a legacy short story without visual metadata", async () => {
    root = await mkdtemp(join(tmpdir(), "storyos-legacy-style-"));
    await setRecentCraftId(root, "ghost-craft");
    const pipeline = {
      listCrafts: async () => [{ id: "ghost-craft", artStyle: "cg3d" }],
    } as never;

    await expect(resolveStoryArtStyle(root, "short", "legacy-story", pipeline)).resolves.toBe("cg3d");
  });

  it("uses the short story's persisted craft instead of the current recent selection", async () => {
    root = await mkdtemp(join(tmpdir(), "storyos-story-craft-"));
    await mkdir(join(root, "shorts", "finished-story"), { recursive: true });
    await writeFile(
      join(root, "shorts", "finished-story", "story-config.json"),
      JSON.stringify({ craftId: "story-craft" }),
      "utf-8",
    );
    await setRecentCraftId(root, "newer-unrelated-craft");

    await expect(resolveStoryCraftId(root, "short", "finished-story")).resolves.toBe("story-craft");
  });
});
