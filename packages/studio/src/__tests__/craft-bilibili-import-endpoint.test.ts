import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const importBilibiliSourceMock = vi.hoisted(() => vi.fn());
const correctBilibiliSubtitlesMock = vi.hoisted(() => vi.fn());
const loadProjectConfigMock = vi.hoisted(() => vi.fn());
const createLLMClientMock = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("../api/bilibili.js", () => ({
  importBilibiliSource: importBilibiliSourceMock,
  parseBvid: (input: string) => input.trim().match(/^BV[a-zA-Z0-9]{10}$/)?.[0] ?? null,
  subtitleText: (entries: Array<{ from: number; to: number; content: string }>) =>
    entries.map((entry) => `[${entry.from.toFixed(1)}s-${entry.to.toFixed(1)}s] ${entry.content}`).join("\n"),
}));

vi.mock("../api/bilibili-subtitle-correction.js", () => ({
  correctBilibiliSubtitles: correctBilibiliSubtitlesMock,
}));

vi.mock("@actalk/inkos-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@actalk/inkos-core")>();
  return {
    ...actual,
    createLLMClient: createLLMClientMock,
    loadProjectConfig: loadProjectConfigMock,
  };
});

const projectConfig = {
  name: "bilibili-import-test",
  version: "0.1.0",
  language: "zh" as const,
  llm: {
    provider: "openai",
    baseUrl: "https://api.example.com/v1",
    apiKey: "test-key",
    model: "test-model",
    temperature: 0,
    maxTokens: 4096,
    stream: false,
  },
  modelOverrides: {},
  notify: [],
};

describe("Bilibili craft import subtitle correction", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "storyos-bilibili-import-test-"));
    loadProjectConfigMock.mockResolvedValue(projectConfig);
    importBilibiliSourceMock.mockResolvedValue({
      videoInfo: { bvid: "BV1test00001", aid: 1, cid: 2, title: "测试视频", duration: 12 },
      subtitleSource: "bili",
      subtitles: [{ from: 0, to: 1.2, content: "他盗着烧箱" }],
      text: "[0.0s-1.2s] 他盗着烧箱",
    });
    correctBilibiliSubtitlesMock.mockResolvedValue({
      status: "corrected",
      entries: [{ from: 0, to: 1.2, content: "他倒着烧香" }],
      changedCount: 1,
    });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("retains raw subtitle files while using corrected text as analysis input", async () => {
    const { createStudioServer } = await import("../api/server.js");
    const app = createStudioServer(projectConfig as never, root);

    const response = await app.request("http://localhost/api/v1/craft/bilibili/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "BV1test00001" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as {
      sourceAssetId: string;
      text: string;
      subtitlePreview: Array<{ content: string }>;
      correctionStatus: string;
      correctionChangedCount: number;
    };
    expect(body.text).toBe("[0.0s-1.2s] 他倒着烧香");
    expect(body.subtitlePreview[0]?.content).toBe("他倒着烧香");
    expect(body.correctionStatus).toBe("corrected");
    expect(body.correctionChangedCount).toBe(1);

    const assetDir = join(root, "craft-source-uploads", body.sourceAssetId);
    expect((await stat(assetDir)).isDirectory()).toBe(true);
    expect(await readFile(join(assetDir, "subtitles.json"), "utf8")).toContain("他盗着烧箱");
    expect(await readFile(join(assetDir, "subtitles.txt"), "utf8")).toBe("[0.0s-1.2s] 他盗着烧箱");
    expect(await readFile(join(assetDir, "analysis-input.txt"), "utf8")).toBe("[0.0s-1.2s] 他倒着烧香");
    expect(correctBilibiliSubtitlesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ client: {}, model: "test-model" }),
    );
  });

  it("returns a pending craft immediately and exposes its background status", async () => {
    importBilibiliSourceMock.mockImplementationOnce(() => new Promise(() => undefined));
    const { createStudioServer } = await import("../api/server.js");
    const app = createStudioServer(projectConfig as never, root);

    const response = await app.request("http://localhost/api/v1/craft/bilibili/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "BV1test00001" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { status: string; craftId: string; meta: { processingStatus?: string } };
    expect(body.status).toBe("processing");
    expect(body.meta.processingStatus).toBe("processing");

    const statusResponse = await app.request(`http://localhost/api/v1/crafts/${body.craftId}/status`);
    expect(statusResponse.status).toBe(200);
    const status = await statusResponse.json() as { status: string; meta: { id: string; processingStatus?: string } };
    expect(status.status).toBe("processing");
    expect(status.meta.id).toBe(body.craftId);
  });

  it("persists the failing stage and exposes the detailed background error", async () => {
    importBilibiliSourceMock.mockRejectedValueOnce(new Error("Bcut 识别超时"));
    const { createStudioServer } = await import("../api/server.js");
    const app = createStudioServer(projectConfig as never, root);

    const response = await app.request("http://localhost/api/v1/craft/bilibili/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "BV1test00001" }),
    });
    const body = await response.json() as { craftId: string };

    await vi.waitFor(async () => {
      const statusResponse = await app.request(`http://localhost/api/v1/crafts/${body.craftId}/status`);
      expect(statusResponse.status).toBe(200);
      const status = await statusResponse.json() as {
        status: string;
        meta: { processingStatus?: string; processingStage?: string; processingError?: string };
      };
      expect(status.status).toBe("error");
      expect(status.meta.processingStatus).toBe("error");
      expect(status.meta.processingStage).toContain("正在获取视频与字幕");
      expect(status.meta.processingError).toContain("Bcut 识别超时");
    });
  });

  it("includes the underlying network cause and code in background errors", async () => {
    const cause = Object.assign(new Error("connect timeout"), { code: "UND_ERR_CONNECT_TIMEOUT" });
    importBilibiliSourceMock.mockRejectedValueOnce(Object.assign(new Error("fetch failed"), { cause }));
    const { createStudioServer } = await import("../api/server.js");
    const app = createStudioServer(projectConfig as never, root);

    const response = await app.request("http://localhost/api/v1/craft/bilibili/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "BV1test00001" }),
    });
    const body = await response.json() as { craftId: string };

    await vi.waitFor(async () => {
      const statusResponse = await app.request(`http://localhost/api/v1/crafts/${body.craftId}/status`);
      expect(statusResponse.status).toBe(200);
      const status = await statusResponse.json() as {
        meta: { processingError?: string };
      };
      expect(status.meta.processingError).toContain("fetch failed");
      expect(status.meta.processingError).toContain("cause=connect timeout");
      expect(status.meta.processingError).toContain("causeCode=UND_ERR_CONNECT_TIMEOUT");
    });
  });
});
