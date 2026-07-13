import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { isSafeBookId } from "./safety.js";

export interface StudioShortStorySummary {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly status: "completed";
  readonly chaptersWritten: number;
  readonly wordCount: number;
  readonly updatedAt: number;
}

interface ShortStoryArtifact {
  readonly storyTitle?: unknown;
  readonly openingHook?: unknown;
  readonly summary?: unknown;
  readonly chapters?: unknown;
}

interface ShortStorySalesPackage {
  readonly intro?: unknown;
}

function readWordCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.reduce((total, chapter) => {
    if (!chapter || typeof chapter !== "object") return total;
    const chapterData = chapter as { wordCount?: unknown; charCount?: unknown };
    const wordCount = chapterData.wordCount ?? chapterData.charCount;
    return total + (typeof wordCount === "number" && Number.isFinite(wordCount) && wordCount >= 0 ? wordCount : 0);
  }, 0);
}

export async function listStudioShortStories(root: string): Promise<ReadonlyArray<StudioShortStorySummary>> {
  const shortRoot = join(root, "shorts");
  const entries = await readdir(shortRoot, { withFileTypes: true }).catch(() => []);
  const stories = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && isSafeBookId(entry.name))
    .map(async (entry): Promise<StudioShortStorySummary | null> => {
      const finalDir = join(shortRoot, entry.name, "final");
      const fullPath = join(finalDir, "full.md");
      try {
        const fileStats = await stat(fullPath);
        if (!fileStats.isFile()) return null;
        const fullContent = await readFile(fullPath, "utf-8").catch(() => "");

        const rawArtifact = await readFile(join(finalDir, "short-story.json"), "utf-8").catch(() => "");
        let artifact: ShortStoryArtifact = {};
        try {
          artifact = rawArtifact ? JSON.parse(rawArtifact) as ShortStoryArtifact : {};
        } catch {
          artifact = {};
        }
        const rawSalesPackage = await readFile(join(finalDir, "sales-package.json"), "utf-8").catch(() => "");
        let salesPackage: ShortStorySalesPackage = {};
        try {
          salesPackage = rawSalesPackage ? JSON.parse(rawSalesPackage) as ShortStorySalesPackage : {};
        } catch {
          salesPackage = {};
        }
        const chapters = Array.isArray(artifact.chapters) ? artifact.chapters.length : 1;
        const title = typeof artifact.storyTitle === "string" && artifact.storyTitle.trim()
          ? artifact.storyTitle.trim()
          : entry.name;
        const summary = [salesPackage.intro, artifact.summary, artifact.openingHook]
          .find((value): value is string => typeof value === "string" && value.trim().length > 0)
          ?.trim();

        const artifactWordCount = readWordCount(artifact.chapters);
        const wordCount = artifactWordCount > 0
          ? artifactWordCount
          : fullContent.replace(/\s+/g, "").length;

        return {
          id: entry.name,
          title,
          ...(summary ? { summary } : {}),
          status: "completed",
          chaptersWritten: chapters,
          wordCount,
          updatedAt: fileStats.mtimeMs,
        };
      } catch {
        return null;
      }
    }));

  return stories
    .filter((story): story is StudioShortStorySummary => story !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
