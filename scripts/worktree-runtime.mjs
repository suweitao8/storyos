import { createServer } from "node:net";
import { resolve } from "node:path";

const DEFAULT_CLIENT_PORT = 4600;
const PORT_SLOT_COUNT = 90;

export function slugifyBranchName(branch = "") {
  const withoutPrefix = branch.replace(/^codex\//i, "");
  const ascii = withoutPrefix.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
  const slug = ascii
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || "worktree";
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function parsePort(value, name) {
  if (value === undefined || value === "") return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
}

export function createRuntimeConfig({ branch = "", projectRoot, env = process.env }) {
  if (!projectRoot) throw new Error("projectRoot is required");
  const taskSlug = slugifyBranchName(branch);
  const preferredClientPort =
    DEFAULT_CLIENT_PORT + (stableHash(taskSlug) % PORT_SLOT_COUNT) * 2;
  const explicitClientPort = parsePort(
    env.INKOS_STUDIO_CLIENT_PORT,
    "INKOS_STUDIO_CLIENT_PORT",
  );
  const explicitServerPort = parsePort(env.INKOS_STUDIO_PORT, "INKOS_STUDIO_PORT");
  const clientPort = explicitClientPort ?? (explicitServerPort ? explicitServerPort - 2 : preferredClientPort);
  const serverPort = explicitServerPort ?? clientPort + 2;

  if (clientPort < 1 || serverPort > 65535) {
    throw new Error("Studio client/server ports must fit within the valid port range");
  }

  return {
    taskSlug,
    clientPort,
    serverPort,
    logDir: resolve(projectRoot, ".studio-live", taskSlug),
    screenshotDir: resolve(projectRoot, ".screenshots", taskSlug),
    projectRuntimeDir: resolve(projectRoot, ".inkos"),
  };
}

export function isPortAvailable(port, host = "127.0.0.1") {
  return new Promise((resolveAvailability) => {
    const server = createServer();
    const finish = (available) => {
      server.removeAllListeners("error");
      if (server.listening) server.close(() => resolveAvailability(available));
      else resolveAvailability(available);
    };
    server.once("error", () => finish(false));
    server.listen(port, host, () => finish(true));
  });
}

export async function findAvailablePortPair({
  preferredClientPort,
  host = "127.0.0.1",
  maxAttempts = 50,
  isAvailable = (port) => isPortAvailable(port, host),
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const clientPort = preferredClientPort + attempt * 2;
    const serverPort = clientPort + 2;
    if ((await isAvailable(clientPort)) && (await isAvailable(serverPort))) {
      return { clientPort, serverPort };
    }
  }
  throw new Error(`Could not find an available Studio port pair near ${preferredClientPort}`);
}

if (process.argv[1] && process.argv[1].endsWith("worktree-runtime.mjs")) {
  const branch = process.env.GIT_BRANCH ?? "";
  const projectRoot = process.env.INKOS_PROJECT_ROOT ?? process.cwd();
  console.log(JSON.stringify(createRuntimeConfig({ branch, projectRoot }), null, 2));
}
