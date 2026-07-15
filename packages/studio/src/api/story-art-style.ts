import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ArtStyle, PipelineRunner } from "@actalk/inkos-core";

type StoryKind = "short" | "book";

function isArtStyle(value: unknown): value is ArtStyle {
  return value === "realistic" || value === "cg3d";
}

async function readJson(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const value = JSON.parse(await readFile(path, "utf-8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

export async function resolveStoryArtStyle(
  root: string,
  kind: StoryKind,
  storyId: string,
  pipeline: PipelineRunner,
): Promise<ArtStyle> {
  const collection = kind === "short" ? "shorts" : "books";
  const visualConfig = await readJson(join(root, collection, storyId, "story-config.json"));
  if (isArtStyle(visualConfig?.artStyle)) return visualConfig.artStyle;

  const bookConfig = kind === "book"
    ? await readJson(join(root, "books", storyId, "book.json"))
    : undefined;
  const craftId = typeof visualConfig?.craftId === "string"
    ? visualConfig.craftId
    : typeof bookConfig?.craftId === "string" ? bookConfig.craftId : undefined;
  if (craftId) {
    const craft = (await pipeline.listCrafts()).find((candidate) => candidate.id === craftId);
    if (isArtStyle(craft?.artStyle)) return craft.artStyle;
  }
  return "realistic";
}
