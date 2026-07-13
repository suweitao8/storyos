import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { acquireWorktreeLock } from "../worktree-lock.mjs";

test("a released lock can be acquired again", async () => {
  const root = await mkdtemp(join(tmpdir(), "inkos-lock-"));
  const lockPath = join(root, "codex-finish.lock");

  const first = await acquireWorktreeLock(lockPath, { branch: "codex/a" });
  await assert.rejects(
    acquireWorktreeLock(lockPath, { branch: "codex/b" }),
    /already held[\s\S]*codex\/a/,
  );

  await first.release();
  const second = await acquireWorktreeLock(lockPath, { branch: "codex/b" });
  await second.release();
  await rm(root, { recursive: true, force: true });
});

test("lock metadata contains diagnostic ownership fields", async () => {
  const root = await mkdtemp(join(tmpdir(), "inkos-lock-"));
  const lockPath = join(root, "codex-finish.lock");
  const lock = await acquireWorktreeLock(lockPath, {
    branch: "codex/diagnostic",
    worktree: "D:/worktrees/diagnostic",
    pid: 1234,
    now: "2026-07-13T00:00:00.000Z",
  });

  const owner = JSON.parse(await readFile(join(lockPath, "owner.json"), "utf8"));
  assert.deepEqual(owner, {
    branch: "codex/diagnostic",
    worktree: "D:/worktrees/diagnostic",
    pid: 1234,
    now: "2026-07-13T00:00:00.000Z",
  });

  await lock.release();
  await rm(root, { recursive: true, force: true });
});
