import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSecrets } from "../llm/secrets.js";

describe("loadSecrets legacy service id migration", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "storyos-secrets-mig-"));
    await mkdir(join(root, ".storyos"), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function seedSecrets(data: unknown): Promise<void> {
    await writeFile(join(root, ".storyos", "secrets.json"), JSON.stringify(data, null, 2), "utf-8");
  }

  async function readSecretsRaw(): Promise<any> {
    return JSON.parse(await readFile(join(root, ".storyos", "secrets.json"), "utf-8"));
  }

  it("migrates siliconflow to siliconcloud when the target id is missing", async () => {
    await seedSecrets({ services: { siliconflow: { apiKey: "sk-legacy" } } });
    const result = await loadSecrets(root);
    expect(result.services.siliconcloud).toEqual({ apiKey: "sk-legacy" });
    expect(result.services.siliconflow).toBeUndefined();

    const onDisk = await readSecretsRaw();
    expect(onDisk.services.siliconcloud).toEqual({ apiKey: "sk-legacy" });
    expect(onDisk.services.siliconflow).toBeUndefined();
  });

  it("migrates grsai to cover:grsai when the target id is missing", async () => {
    await seedSecrets({ services: { grsai: { apiKey: "sk-cover" } } });
    const result = await loadSecrets(root);
    expect(result.services["cover:grsai"]).toEqual({ apiKey: "sk-cover" });
    expect(result.services.grsai).toBeUndefined();

    const onDisk = await readSecretsRaw();
    expect(onDisk.services["cover:grsai"]).toEqual({ apiKey: "sk-cover" });
    expect(onDisk.services.grsai).toBeUndefined();
  });

  it("migrates bailian to voice:bailian when the target id is missing", async () => {
    await seedSecrets({ services: { bailian: { apiKey: "sk-voice" } } });
    const result = await loadSecrets(root);
    expect(result.services["voice:bailian"]).toEqual({ apiKey: "sk-voice" });
    expect(result.services.bailian).toBeUndefined();

    const onDisk = await readSecretsRaw();
    expect(onDisk.services["voice:bailian"]).toEqual({ apiKey: "sk-voice" });
    expect(onDisk.services.bailian).toBeUndefined();
  });

  it("does not migrate when the new namespaced ids already exist", async () => {
    await seedSecrets({
      services: {
        siliconflow: { apiKey: "sk-legacy" },
        siliconcloud: { apiKey: "sk-new" },
        grsai: { apiKey: "sk-old-cover" },
        "cover:grsai": { apiKey: "sk-new-cover" },
        bailian: { apiKey: "sk-old-voice" },
        "voice:bailian": { apiKey: "sk-new-voice" },
      },
    });
    const result = await loadSecrets(root);
    expect(result.services.siliconcloud).toEqual({ apiKey: "sk-new" });
    expect(result.services.siliconflow).toEqual({ apiKey: "sk-legacy" });
    expect(result.services["cover:grsai"]).toEqual({ apiKey: "sk-new-cover" });
    expect(result.services["voice:bailian"]).toEqual({ apiKey: "sk-new-voice" });
    expect(result.services.grsai).toEqual({ apiKey: "sk-old-cover" });
    expect(result.services.bailian).toEqual({ apiKey: "sk-old-voice" });
  });

  it("does not rewrite secrets when there is no migration", async () => {
    await seedSecrets({ services: { openai: { apiKey: "sk-openai" } } });
    const before = await readFile(join(root, ".storyos", "secrets.json"), "utf-8");
    await loadSecrets(root);
    const after = await readFile(join(root, ".storyos", "secrets.json"), "utf-8");
    expect(after).toBe(before);
  });

  it("returns empty services when the secrets file does not exist", async () => {
    await rm(join(root, ".storyos", "secrets.json"), { force: true });
    const result = await loadSecrets(root);
    expect(result).toEqual({ services: {} });
  });

  it("is idempotent across repeated loadSecrets calls", async () => {
    await seedSecrets({ services: { siliconflow: { apiKey: "sk-legacy" } } });
    await loadSecrets(root);
    const r2 = await loadSecrets(root);
    expect(r2.services.siliconcloud).toEqual({ apiKey: "sk-legacy" });
    expect(r2.services.siliconflow).toBeUndefined();
  });
});
