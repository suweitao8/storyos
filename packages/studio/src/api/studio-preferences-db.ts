import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);

const RECENT_CRAFT_KEY = "recent_craft_id";
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS studio_preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

type Database = import("node:sqlite").DatabaseSync;

async function withDatabase<T>(projectRoot: string, operation: (database: Database) => T): Promise<T> {
  const inkosDirectory = join(projectRoot, ".inkos");
  await mkdir(inkosDirectory, { recursive: true });

  let DatabaseSync: typeof import("node:sqlite").DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite"));
  } catch (error) {
    throw new Error("Studio preferences require Node 22 or newer with node:sqlite support.", { cause: error });
  }

  const database = new DatabaseSync(join(inkosDirectory, "studio.db"));
  try {
    database.exec(CREATE_TABLE_SQL);
    return operation(database);
  } finally {
    database.close();
  }
}

export function getRecentCraftId(projectRoot: string): Promise<string | null> {
  return withDatabase(projectRoot, (database) => {
    const row = database
      .prepare("SELECT value FROM studio_preferences WHERE key = ?")
      .get(RECENT_CRAFT_KEY) as { value: string } | undefined;
    return row?.value ?? null;
  });
}

export function setRecentCraftId(projectRoot: string, craftId: string): Promise<void> {
  return withDatabase(projectRoot, (database) => {
    database
      .prepare(`
        INSERT INTO studio_preferences (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = datetime('now')
      `)
      .run(RECENT_CRAFT_KEY, craftId);
  });
}

export function clearRecentCraftId(projectRoot: string): Promise<void> {
  return withDatabase(projectRoot, (database) => {
    database
      .prepare("DELETE FROM studio_preferences WHERE key = ?")
      .run(RECENT_CRAFT_KEY);
  });
}

export function clearRecentCraftIdIfMatches(projectRoot: string, craftId: string): Promise<void> {
  return withDatabase(projectRoot, (database) => {
    database
      .prepare("DELETE FROM studio_preferences WHERE key = ? AND value = ?")
      .run(RECENT_CRAFT_KEY, craftId);
  });
}
