import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assertWorktreeSafe } from "../worktree-guard.mjs";

const baseContext = {
  mainRoot: "D:/storyos",
  worktreePath: "D:/storyos/.worktrees/story-settings",
  gitDir: "D:/storyos/.git/worktrees/story-settings",
  gitCommonDir: "D:/storyos/.git",
  branch: "codex/story-settings",
  worktreeStatus: "",
  mainStatus: "",
};

test("accepts a clean linked worktree under .worktrees", () => {
  assert.equal(assertWorktreeSafe(baseContext, { forFinish: true }), baseContext);
});

test("rejects the main checkout", () => {
  assert.throws(
    () => assertWorktreeSafe({ ...baseContext, gitDir: baseContext.gitCommonDir }),
    /linked worktree/i,
  );
});

test("rejects the base branch in a linked worktree", () => {
  assert.throws(
    () => assertWorktreeSafe({ ...baseContext, branch: "master" }),
    /base branch|master/i,
  );
});

test("rejects linked worktrees outside the owned directory", () => {
  assert.throws(
    () => assertWorktreeSafe({ ...baseContext, worktreePath: "D:/other-worktrees/story-settings" }),
    /\.worktrees/i,
  );
});

test("requires clean states when finishing", () => {
  assert.throws(
    () => assertWorktreeSafe({ ...baseContext, worktreeStatus: " M scripts/example.mjs" }, { forFinish: true }),
    /worktree is not clean/i,
  );
  assert.throws(
    () => assertWorktreeSafe({ ...baseContext, mainStatus: "?? shorts/" }, { forFinish: true }),
    /main checkout is not clean/i,
  );
});
