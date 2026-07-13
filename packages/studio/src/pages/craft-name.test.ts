import { describe, expect, it } from "vitest";
import { normalizeBilibiliCraftName, normalizeCraftDisplayName } from "./craft-name.js";

describe("normalizeCraftDisplayName", () => {
  it("decodes URI-encoded names", () => {
    expect(normalizeCraftDisplayName("%E6%88%91%E7%9A%84%E6%B2%BB%E6%84%88%E7%B3%BB%E6%B8%B8%E6%88%8F"))
      .toBe("我的治愈系游戏");
  });

  it("strips trailing chapter-count markers", () => {
    expect(normalizeCraftDisplayName("我的治愈系游戏_100")).toBe("我的治愈系游戏");
    expect(normalizeCraftDisplayName("我的治愈系游戏-100")).toBe("我的治愈系游戏");
    expect(normalizeCraftDisplayName("我的治愈系游戏 100")).toBe("我的治愈系游戏");
  });

  it("extracts the actual work name from a promotional Bilibili title", () => {
    expect(normalizeBilibiliCraftName("半口气看完《 罪恶 》合集 悬疑动画！")).toBe("罪恶");
    expect(normalizeBilibiliCraftName("半口气看完罪恶合集悬疑动画！")).toBe("罪恶");
    expect(normalizeBilibiliCraftName("一口气看完：恶魔城全集")).toBe("恶魔城");
  });
});
