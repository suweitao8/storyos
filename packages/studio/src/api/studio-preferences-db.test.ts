import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearRecentCraftId,
  getRecentCraftId,
  setRecentCraftId,
} from "./studio-preferences-db";

const require = createRequire(import.meta.url);
const sqlite = (() => {
  try {
    return require("node:sqlite") as typeof import("node:sqlite");
  } catch {
    return null;
  }
})();
const projectRoots: string[] = [];

afterEach(async () => {
  await Promise.all(projectRoots.splice(0).map((projectRoot) => rm(projectRoot, { recursive: true, force: true })));
});

async function createProjectRoot() {
  const projectRoot = await mkdtemp(join(tmpdir(), "studio-preferences-"));
  projectRoots.push(projectRoot);
  return projectRoot;
}

describe.skipIf(sqlite === null)("studio preferences database", () => {
  it("creates the project database and returns null when no recent craft exists", async () => {
    if (sqlite === null) return;
    const projectRoot = await createProjectRoot();

    expect(await getRecentCraftId(projectRoot)).toBeNull();

    const databasePath = join(projectRoot, ".inkos", "studio.db");
    expect(await readFile(databasePath)).toBeInstanceOf(Buffer);

    const database = new sqlite.DatabaseSync(databasePath);
    try {
      const table = database
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'studio_preferences'")
        .get() as { sql: string };
      expect(table.sql).toContain("key TEXT PRIMARY KEY");
      expect(table.sql).toContain("value TEXT NOT NULL");
      expect(table.sql).toContain("updated_at TEXT NOT NULL DEFAULT (datetime('now'))");
    } finally {
      database.close();
    }
  });

  it("persists and replaces the recent craft id", async () => {
    const projectRoot = await createProjectRoot();

    await setRecentCraftId(projectRoot, "craft-001");
    expect(await getRecentCraftId(projectRoot)).toBe("craft-001");

    await setRecentCraftId(projectRoot, "craft-002");
    expect(await getRecentCraftId(projectRoot)).toBe("craft-002");
  });

  it("clears the recent craft id and remains idempotent", async () => {
    const projectRoot = await createProjectRoot();
    await setRecentCraftId(projectRoot, "craft-001");

    await clearRecentCraftId(projectRoot);
    expect(await getRecentCraftId(projectRoot)).toBeNull();

    await clearRecentCraftId(projectRoot);
    expect(await getRecentCraftId(projectRoot)).toBeNull();
  });
});
