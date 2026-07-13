import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

function formatOwner(owner) {
  try {
    return JSON.stringify(owner, null, 2);
  } catch {
    return String(owner);
  }
}

export async function acquireWorktreeLock(lockPath, metadata = {}) {
  const owner = {
    ...metadata,
    pid: metadata.pid ?? process.pid,
    now: metadata.now ?? new Date().toISOString(),
  };

  try {
    await mkdir(lockPath);
  } catch (error) {
    if (error?.code === "EEXIST") {
      let existing = "owner information unavailable";
      try {
        existing = await readFile(join(lockPath, "owner.json"), "utf8");
      } catch {
        // The lock may be between directory creation and metadata write.
      }
      throw new Error(`Finish lock already held at ${lockPath}\n${existing}`);
    }
    throw error;
  }

  try {
    await writeFile(join(lockPath, "owner.json"), `${formatOwner(owner)}\n`, "utf8");
  } catch (error) {
    await rm(lockPath, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  let released = false;
  return {
    owner,
    async release() {
      if (released) return;
      released = true;
      await rm(lockPath, { recursive: true, force: true });
    },
  };
}
