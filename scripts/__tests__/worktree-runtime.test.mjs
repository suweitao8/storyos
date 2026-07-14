import { strict as assert } from "node:assert";
import { createServer } from "node:net";
import { join } from "node:path";
import { test } from "node:test";
import {
  createRuntimeConfig,
  findAvailablePortPair,
  isPortAvailable,
  slugifyBranchName,
} from "../worktree-runtime.mjs";

test("branch names become safe stable task slugs", () => {
  assert.equal(slugifyBranchName("codex/story-settings/assets"), "story-settings-assets");
  assert.equal(slugifyBranchName("feature/中文 name"), "feature-name");
  assert.equal(slugifyBranchName(""), "worktree");
});

test("runtime config is stable and worktree-local", () => {
  const projectRoot = "D:/work/storyos/.worktrees/story-settings";
  const config = createRuntimeConfig({
    branch: "codex/story-settings/assets",
    projectRoot,
  });

  assert.equal(config.taskSlug, "story-settings-assets");
  assert.match(config.clientPort.toString(), /^4[6-7]\d\d$/);
  assert.equal(config.serverPort, config.clientPort + 2);
  assert.equal(config.logDir, join(projectRoot, ".studio-live", "story-settings-assets"));
  assert.equal(config.screenshotDir, join(projectRoot, ".screenshots", "story-settings-assets"));
  assert.equal(config.projectRuntimeDir, join(projectRoot, ".storyos"));
});

test("explicit ports override stable defaults", () => {
  const config = createRuntimeConfig({
    branch: "codex/custom-ports",
    projectRoot: "D:/work/storyos/.worktrees/custom-ports",
    env: {
      STORYOS_STUDIO_CLIENT_PORT: "4900",
      STORYOS_STUDIO_PORT: "4902",
    },
  });

  assert.equal(config.clientPort, 4900);
  assert.equal(config.serverPort, 4902);
});

test("port pair probing skips occupied candidates", async () => {
  const occupied = new Set([4600, 4602, 4604]);
  const calls = [];
  const ports = await findAvailablePortPair({
    preferredClientPort: 4600,
    isAvailable: async (port) => {
      calls.push(port);
      return !occupied.has(port);
    },
  });

  assert.deepEqual(ports, { clientPort: 4606, serverPort: 4608 });
  assert.deepEqual(calls, [4600, 4602, 4604, 4606, 4608]);
});

test("real port availability can be checked", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  assert.equal(await isPortAvailable(port), false);
  await new Promise((resolve) => server.close(resolve));
  assert.equal(await isPortAvailable(port), true);
});
