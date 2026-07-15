import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isSafeBookId } from "./safety.js";
import { isSoftDeleteExpired, sortSoftDeletedLast } from "./soft-delete.js";

export interface StudioShortStorySummary {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly status: "completed";
  readonly chaptersWritten: number;
  readonly wordCount: number;
  readonly updatedAt: number;
  readonly deletedAt?: string;
}

const TRASH_MARKER = ".trash.json";

interface TrashMarker {
  readonly deletedAt: string;
}

function shortStoryDir(root: string, storyId: string): string {
  if (!isSafeBookId(storyId)) throw new Error("Invalid short story id");
  return join(root, "shorts", storyId);
}

async function readTrashMarker(directory: string): Promise<TrashMarker | null> {
  try {
    return JSON.parse(await readFile(join(directory, TRASH_MARKER), "utf-8")) as TrashMarker;
  } catch {
    return null;
  }
}

export async function softDeleteShortStory(root: string, storyId: string, deletedAt = new Date().toISOString()): Promise<void> {
  const directory = shortStoryDir(root, storyId);
  await writeFile(join(directory, TRASH_MARKER), JSON.stringify({ deletedAt }, null, 2), "utf-8");
}

export async function restoreShortStory(root: string, storyId: string): Promise<void> {
  const directory = shortStoryDir(root, storyId);
  await stat(directory);
  await rm(join(directory, TRASH_MARKER), { force: true });
}

export async function getShortStoryDeletedAt(root: string, storyId: string): Promise<string | undefined> {
  const marker = await readTrashMarker(shortStoryDir(root, storyId));
  return marker?.deletedAt;
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

interface ShortStoryRunStatus {
  readonly status?: unknown;
}

async function isFailedShortStoryRun(directory: string): Promise<boolean> {
  try {
    const status = JSON.parse(await readFile(join(directory, "status.json"), "utf-8")) as ShortStoryRunStatus;
    return status.status === "failed";
  } catch {
    return false;
  }
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
      const directory = join(shortRoot, entry.name);
      const trash = await readTrashMarker(directory);
      if (trash?.deletedAt && isSoftDeleteExpired(trash.deletedAt)) {
        await rm(directory, { recursive: true, force: true });
        return null;
      }
      const finalDir = join(shortRoot, entry.name, "final");
      const fullPath = join(finalDir, "full.md");
      try {
        if (await isFailedShortStoryRun(directory)) return null;
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
          ...(trash?.deletedAt ? { deletedAt: trash.deletedAt } : {}),
        };
      } catch {
        return null;
      }
    }));

  const visibleStories = stories.filter((story): story is StudioShortStorySummary => story !== null);
  return [...sortSoftDeletedLast(visibleStories)].sort((a, b) => {
    const leftDeleted = Boolean(a.deletedAt);
    const rightDeleted = Boolean(b.deletedAt);
    if (leftDeleted !== rightDeleted) return leftDeleted ? 1 : -1;
    return b.updatedAt - a.updatedAt;
  });
}
