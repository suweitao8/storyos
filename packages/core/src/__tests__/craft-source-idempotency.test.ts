import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CraftAnalyzerAgent } from "../agents/craft-analyzer.js";
import { PipelineRunner } from "../pipeline/runner.js";
import type { CraftProfile } from "../models/craft-profile.js";

const profile: CraftProfile = {
  sourceName: "测试视频",
  analyzedAt: "2026-07-13T00:00:00.000Z",
  language: "zh",
  mode: "ghost-story",
  worldview: "规则世界",
  storyOutline: "故事骨架",
  structure: { openingPattern: "异常", chapterArc: "升级", endingHookType: "悬念" },
  sceneRhythm: { sceneTransitionTechnique: "硬切", pacingCurve: "前快后紧", conflictEscalation: "逐层升级" },
  informationDisclosure: { foreshadowingDensity: "高", informationReleaseRhythm: "逐层", suspenseManagement: "延迟回答" },
  narrativePerspective: { povStrategy: "近景", narrationDialogueRatio: "叙述主导", narrativeDistance: "近" },
  ghostStory: {
    fearCore: "未知",
    supernaturalRules: "规则",
    taboos: "禁忌",
    protagonistVulnerability: "脆弱点",
    clueSystem: "线索",
    revealCadence: "揭示",
    scareCadence: "惊吓",
    escalationLadder: "升级",
    sensoryMotifs: "声音",
    endingAftertaste: "余韵",
  },
  exemplars: [],
};

describe("video craft source idempotency", () => {
  afterEach(() => vi.restoreAllMocks());

  it("persists processing status before analysis and marks the same craft ready after analysis", async () => {
    const root = await mkdtemp(join(tmpdir(), "storyos-craft-processing-"));
    try {
      vi.spyOn(CraftAnalyzerAgent.prototype, "analyze").mockResolvedValue(profile);
      const runner = new PipelineRunner({
        client: {
          provider: "openai",
          apiFormat: "chat",
          stream: false,
          defaults: { temperature: 0, maxTokens: 1000, thinkingBudget: 0 },
        } as never,
        model: "test-model",
        projectRoot: root,
      });

      const pending = await runner.createPendingCraft({
        craftId: "pending-craft",
        sourceName: "BV1YBTb6sEEr",
        language: "zh",
        mode: "bilibili-short-story",
        sourceType: "bilibili",
        sourceRef: "BV1YBTb6sEEr",
      });
      expect(pending.processingStatus).toBe("processing");
      expect((await runner.listCrafts())[0]?.processingStatus).toBe("processing");

      await runner.updateCraftProcessing("pending-craft", {
        processingStage: "正在获取字幕",
      });
      expect((await runner.listCrafts())[0]?.processingStage).toBe("正在获取字幕");

      const result = await runner.analyzeCraft(
        "字幕",
        "测试视频",
        "zh",
        "bilibili-short-story",
        "bilibili",
        "BV1YBTb6sEEr",
        undefined,
        "pending-craft",
      );
      expect(result.craftId).toBe("pending-craft");
      const readyMeta = JSON.parse(await readFile(join(root, "crafts", "pending-craft", "meta.json"), "utf8")) as { processingStatus?: string };
      expect(readyMeta.processingStatus).toBe("ready");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("persists a retryable processing error without deleting the craft", async () => {
    const root = await mkdtemp(join(tmpdir(), "storyos-craft-processing-error-"));
    try {
      const runner = new PipelineRunner({
        client: {} as never,
        model: "test-model",
        projectRoot: root,
      });
      await runner.createPendingCraft({
        craftId: "failed-craft",
        sourceName: "BV1YBTb6sEEr",
        language: "zh",
        mode: "bilibili-short-story",
        sourceType: "bilibili",
        sourceRef: "BV1YBTb6sEEr",
      });

      const errorMeta = await runner.updateCraftProcessing("failed-craft", {
        processingStatus: "error",
        processingStage: "后台任务失败",
        processingError: "字幕获取失败",
      });

      expect(errorMeta.processingStatus).toBe("error");
      expect(errorMeta.processingError).toBe("字幕获取失败");
      expect((await runner.listCrafts())[0]?.id).toBe("failed-craft");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reuses the existing craft directory when the same BVID is reparsed", async () => {
    const root = await mkdtemp(join(tmpdir(), "storyos-craft-idempotency-"));
    try {
      vi.spyOn(CraftAnalyzerAgent.prototype, "analyze").mockResolvedValue(profile);
      const runner = new PipelineRunner({
        client: {
          provider: "openai",
          apiFormat: "chat",
          stream: false,
          defaults: { temperature: 0, maxTokens: 1000, thinkingBudget: 0 },
        } as never,
        model: "test-model",
        projectRoot: root,
      });

      const first = await runner.analyzeCraft("字幕一", "测试视频", "zh", "ghost-story", "bilibili", "https://www.bilibili.com/video/BV1YBTb6sEEr/?x=1");
      const second = await runner.analyzeCraft("字幕二", "测试视频", "zh", "ghost-story", "bilibili", "BV1YBTb6sEEr");

      expect(second.craftId).toBe(first.craftId);
      expect(await readdir(join(root, "crafts"))).toEqual([first.craftId]);
      const meta = JSON.parse(await readFile(join(root, "crafts", first.craftId, "meta.json"), "utf8")) as { sourceRef?: string };
      expect(meta.sourceRef).toBe("BV1YBTb6sEEr");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("can reparse a novel into its existing craft id even without a source reference", async () => {
    const root = await mkdtemp(join(tmpdir(), "storyos-craft-reparse-"));
    try {
      vi.spyOn(CraftAnalyzerAgent.prototype, "analyze").mockResolvedValue(profile);
      const runner = new PipelineRunner({
        client: {
          provider: "openai",
          apiFormat: "chat",
          stream: false,
          defaults: { temperature: 0, maxTokens: 1000, thinkingBudget: 0 },
        } as never,
        model: "test-model",
        projectRoot: root,
      });

      const first = await runner.analyzeCraft("原始文本", "测试小说", "zh", "general", "novel");
      const second = await runner.analyzeCraft("更新文本", "测试小说", "zh", "general", "novel", undefined, undefined, first.craftId);

      expect(second.craftId).toBe(first.craftId);
      expect(await readdir(join(root, "crafts"))).toEqual([first.craftId]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
