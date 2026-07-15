import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promptOverridePath } from "@actalk/inkos-core";
import { createStudioServer } from "../api/server.js";

describe("Studio prompt pack endpoints", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "storyos-studio-prompts-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("lists built-in prompt packs with project override status", async () => {
    const overridePath = promptOverridePath(root, "longform.writer");
    await mkdir(overridePath.slice(0, overridePath.lastIndexOf("/")), { recursive: true });
    await writeFile(overridePath, "PROJECT WRITER", "utf-8");

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/v1/prompt-packs");
    const json = await res.json() as {
      packs: Array<{ id: string; prompts: string[] }>;
      prompts: Array<{ id: string; packId: string; content: string; defaultContent: string; source: string; overridden: boolean; path?: string }>;
    };

    expect(res.status).toBe(200);
    expect(json.packs.map((pack) => pack.id)).toContain("longform");
    expect(json.prompts).toContainEqual(expect.objectContaining({
      id: "longform.writer",
      packId: "longform",
      content: "PROJECT WRITER",
      source: "project",
      overridden: true,
      path: "prompt/longform/writer.md",
    }));
    expect(json.prompts.find((prompt) => prompt.id === "longform.reviser")?.source).toBe("builtin");
    expect(json.prompts.find((prompt) => prompt.id === "longform.writer")?.defaultContent)
      .toContain("受控的章节意图");
  });

  it("saves and resets project prompt overrides", async () => {
    const app = createStudioServer({} as never, root);

    const saveRes = await app.request("/api/v1/prompt-packs/longform.writer", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Write carefully and preserve author intent." }),
    });
    expect(saveRes.status).toBe(200);
    const saved = await saveRes.json() as { prompt: { id: string; source: string; overridden: boolean; path: string } };
    expect(saved.prompt).toMatchObject({
      id: "longform.writer",
      source: "project",
      overridden: true,
      path: "prompt/longform/writer.md",
    });
    await expect(readFile(promptOverridePath(root, "longform.writer"), "utf-8"))
      .resolves
      .toContain("preserve author intent");

    const resetRes = await app.request("/api/v1/prompt-packs/longform.writer", { method: "DELETE" });
    expect(resetRes.status).toBe(200);
    const reset = await resetRes.json() as { prompt: { id: string; source: string; overridden: boolean; content: string } };
    expect(reset.prompt).toMatchObject({
      id: "longform.writer",
      source: "builtin",
      overridden: false,
    });
    expect(reset.prompt.content).toContain("受控的章节意图");
  });

  it("rejects unknown prompt ids instead of writing arbitrary files", async () => {
    const app = createStudioServer({} as never, root);

    const res = await app.request("/api/v1/prompt-packs/../../bad", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "bad" }),
    });

    expect(res.status).toBe(404);
  });
});
