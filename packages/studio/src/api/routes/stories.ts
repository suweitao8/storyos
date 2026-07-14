import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { computeAnalytics, countChapterLength } from "@actalk/inkos-core";
import { isSafeBookId } from "../safety.js";
import { splitShortOutlineSections } from "../short-outline-sections.js";
import { getShortStoryDeletedAt } from "../short-story-list.js";
import { isSoftDeleteExpired, sortSoftDeletedLast } from "../soft-delete.js";
import type { StudioRouteContext } from "./context.js";

interface ShortStoryContentArtifact {
  readonly chapters?: unknown;
}

interface SoftDeletedBookSummary {
  readonly deletedAt?: string;
  readonly updatedAt?: string;
}

export function createEmptyStoryContent(id: string, kind: "short" | "book") {
  return {
    book: {
      title: id,
      genre: kind,
      chapterWordCount: 0,
      targetChapters: kind === "short" ? 1 : 0,
    },
    sections: [],
    chapters: [],
  };
}

export function getShortStoryWordCount(
  fullContent: string,
  artifact: ShortStoryContentArtifact | undefined,
): number {
  const artifactCount = Array.isArray(artifact?.chapters)
    ? artifact.chapters.reduce((total, chapter) => {
        if (!chapter || typeof chapter !== "object") return total;
        const value = chapter as { readonly wordCount?: unknown; readonly charCount?: unknown };
        const count = value.wordCount ?? value.charCount;
        return total + (typeof count === "number" && Number.isFinite(count) && count >= 0 ? count : 0);
      }, 0)
    : 0;
  return artifactCount > 0 ? artifactCount : countChapterLength(fullContent, "zh_chars");
}

export function registerStoryReadRoutes(context: StudioRouteContext): void {
  const { app, root, state, loadBookListSummary } = context;

  app.get("/api/v1/books", async (c) => {
    const bookIds = await state.listBooks({ includeDeleted: true });
    const books = await Promise.all(bookIds.map(async (id) => {
      const book = await state.loadBookConfig(id);
      if (isSoftDeleteExpired(book.deletedAt)) {
        await rm(state.bookDir(id), { recursive: true, force: true });
        return null;
      }
      return loadBookListSummary(id);
    }));
    const activeAndTrash = books.filter((book): book is SoftDeletedBookSummary => book !== null);
    return c.json({
      books: [...sortSoftDeletedLast(activeAndTrash)].sort((a, b) => {
        const leftDeleted = Boolean(a.deletedAt);
        const rightDeleted = Boolean(b.deletedAt);
        if (leftDeleted !== rightDeleted) return leftDeleted ? 1 : -1;
        return String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? ""));
      }),
    });
  });

  app.get("/api/v1/shorts", async (c) => {
    const { listStudioShortStories } = await import("../short-story-list.js");
    return c.json({ shorts: await listStudioShortStories(root) });
  });

  app.get("/api/v1/books/:id", async (c) => {
    const id = c.req.param("id");
    try {
      const book = await state.loadBookConfig(id);
      if (book.deletedAt) return c.json({ error: `Book "${id}" is in the trash` }, 404);
      const chapters = await state.loadChapterIndex(id);
      const nextChapter = await state.getNextChapterNumber(id);
      return c.json({ book, chapters, nextChapter });
    } catch {
      return c.json({ error: `Book "${id}" not found` }, 404);
    }
  });

  app.get("/api/v1/books/:id/chapters/:num", async (c) => {
    const id = c.req.param("id");
    const num = parseInt(c.req.param("num"), 10);
    const chaptersDir = join(state.bookDir(id), "chapters");

    try {
      const files = await readdir(chaptersDir);
      const paddedNum = String(num).padStart(4, "0");
      const match = files.find((file) => file.startsWith(paddedNum) && file.endsWith(".md"));
      if (!match) return c.json({ error: "Chapter not found" }, 404);
      const content = await readFile(join(chaptersDir, match), "utf-8");
      return c.json({ chapterNumber: num, filename: match, content });
    } catch {
      return c.json({ error: "Chapter not found" }, 404);
    }
  });

  app.put("/api/v1/books/:id/chapters/:num", async (c) => {
    const id = c.req.param("id");
    const num = parseInt(c.req.param("num"), 10);
    const chaptersDir = join(state.bookDir(id), "chapters");
    const { content } = await c.req.json<{ content: string }>();

    try {
      const files = await readdir(chaptersDir);
      const paddedNum = String(num).padStart(4, "0");
      const match = files.find((file) => file.startsWith(paddedNum) && file.endsWith(".md"));
      if (!match) return c.json({ error: "Chapter not found" }, 404);
      await writeFile(join(chaptersDir, match), content, "utf-8");
      return c.json({ ok: true, chapterNumber: num });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  app.get("/api/v1/books/:id/analytics", async (c) => {
    const id = c.req.param("id");
    try {
      const chapters = await state.loadChapterIndex(id);
      return c.json(computeAnalytics(id, chapters));
    } catch {
      return c.json({ error: `Book "${id}" not found` }, 404);
    }
  });

  app.get("/api/v1/shorts/:id/content", async (c) => {
    const id = c.req.param("id");
    if (!isSafeBookId(id)) return c.json({ error: "Invalid short story id" }, 400);

    const shortDir = join(root, "shorts", id);
    const deletedAt = await getShortStoryDeletedAt(root, id).catch(() => undefined);
    if (deletedAt) {
      if (isSoftDeleteExpired(deletedAt)) await rm(shortDir, { recursive: true, force: true });
      return c.json(createEmptyStoryContent(id, "short"));
    }
    const readOptional = async (file: string): Promise<string> =>
      readFile(join(shortDir, file), "utf-8").catch(() => "");
    const outlineV2 = await readOptional("outline/v002.md");
    const outline = outlineV2.trim() ? outlineV2 : await readOptional("outline/v001.md");
    const full = await readOptional("final/full.md");
    const artifactRaw = await readOptional("final/short-story.json");
    const salesPackage = await readOptional("final/sales-package.md");
    const coverPrompt = await readOptional("final/cover-prompt.md");
    if (!outline.trim() && !full.trim()) {
      return c.json(createEmptyStoryContent(id, "short"));
    }

    let artifact: ShortStoryContentArtifact | undefined;
    try {
      artifact = artifactRaw.trim() ? JSON.parse(artifactRaw) as ShortStoryContentArtifact : undefined;
    } catch {
      artifact = undefined;
    }
    const wordCount = getShortStoryWordCount(full, artifact);

    const outlineFile = outlineV2.trim() ? "outline/v002.md" : "outline/v001.md";
    const sections = [
      ...splitShortOutlineSections(outline, outlineFile),
      salesPackage.trim() ? { file: "final/sales-package.md", title: "故事包装", content: salesPackage } : null,
      coverPrompt.trim() ? { file: "final/cover-prompt.md", title: "封面提示词", content: coverPrompt } : null,
    ].filter((section): section is { file: string; title: string; content: string } => Boolean(section));
    const chapters = full.trim()
      ? [{ number: 1, title: "短篇故事", status: "completed", wordCount, content: full }]
      : [];
    return c.json({
      book: { title: id, genre: "short", chapterWordCount: wordCount, targetChapters: 1 },
      sections,
      chapters,
    });
  });
}
