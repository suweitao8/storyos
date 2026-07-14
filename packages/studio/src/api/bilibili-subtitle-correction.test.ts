import { describe, expect, it, vi } from "vitest";
import type { BilibiliSubtitleEntry } from "./bilibili.js";
import { applySubtitleCorrection, correctBilibiliSubtitles } from "./bilibili-subtitle-correction.js";

const source: BilibiliSubtitleEntry[] = [
  { from: 0, to: 1.2, content: "他倒着烧香" },
  { from: 1.2, to: 2.4, content: "然后回到寺庙" },
];

describe("applySubtitleCorrection", () => {
  it("preserves timestamps and reports no changes when content is unchanged", () => {
    const result = applySubtitleCorrection(source, JSON.stringify([
      { index: 0, content: "他倒着烧香" },
      { index: 1, content: "然后回到寺庙" },
    ]));

    expect(result.entries).toEqual(source);
    expect(result.changedCount).toBe(0);
  });

  it("corrects a likely homophone without changing segment boundaries", () => {
    const result = applySubtitleCorrection(
      [{ from: 0, to: 1.2, content: "他盗着烧箱" }],
      JSON.stringify([{ index: 0, content: "他倒着烧香" }]),
    );

    expect(result.entries).toEqual([{ from: 0, to: 1.2, content: "他倒着烧香" }]);
    expect(result.changedCount).toBe(1);
  });

  it.each([
    ["not json", "not json"],
    ["missing entry", JSON.stringify([{ index: 0, content: "只返回一条" }])],
    ["duplicate index", JSON.stringify([{ index: 0, content: "A" }, { index: 0, content: "B" }])],
    ["unknown index", JSON.stringify([{ index: 0, content: "A" }, { index: 9, content: "B" }])],
    ["blank content", JSON.stringify([{ index: 0, content: "   " }, { index: 1, content: "B" }])],
  ])("rejects %s correction output", (_name, raw) => {
    expect(() => applySubtitleCorrection(source, raw)).toThrow();
  });

  it("sends timestamped entries with a correction-only prompt", async () => {
    const chat = vi.fn().mockResolvedValue({
      content: JSON.stringify([{ index: 0, content: "他倒着烧香" }]),
    });

    const result = await correctBilibiliSubtitles(source.slice(0, 1), {
      client: {} as never,
      model: "test-model",
      chatCompletion: chat,
    });

    expect(result.status).toBe("corrected");
    expect(result.entries[0]?.content).toBe("他倒着烧香");
    expect(chat).toHaveBeenCalledWith(
      {},
      "test-model",
      expect.arrayContaining([
        expect.objectContaining({ role: "system", content: expect.stringContaining("只输出 JSON") }),
        expect.objectContaining({ role: "user", content: expect.stringContaining("[0.0s-1.2s]") }),
      ]),
      expect.objectContaining({ temperature: 0, retry: false }),
    );
  });

  it("falls back to raw entries when the model fails", async () => {
    const result = await correctBilibiliSubtitles(source, {
      client: {} as never,
      model: "test-model",
      chatCompletion: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    });

    expect(result.status).toBe("fallback");
    expect(result.entries).toEqual(source);
    expect(result.changedCount).toBe(0);
    expect(result.message).toContain("原始字幕");
  });
});
