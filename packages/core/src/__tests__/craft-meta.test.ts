import { describe, expect, it } from "vitest";

import { buildCraftMetaSummary, normalizeCraftSourceRef } from "../models/craft-profile.js";

describe("normalizeCraftSourceRef", () => {
  it("uses the BVID as the stable key for equivalent Bilibili URLs", () => {
    expect(normalizeCraftSourceRef(
      "bilibili",
      "https://www.bilibili.com/video/BV1YBTb6sEEr/?spm_id_from=333",
    )).toBe("BV1YBTb6sEEr");
    expect(normalizeCraftSourceRef("bilibili", "BV1YBTb6sEEr")).toBe("BV1YBTb6sEEr");
  });
});

describe("buildCraftMetaSummary", () => {
  it("prefers the extracted story outline and normalizes it for a card", () => {
    expect(buildCraftMetaSummary({
      storyOutline: "  第一幕：主角在旧楼发现异常。\n第二幕：规则逐步失效。  ",
      worldview: "备用世界观",
    })).toBe("第一幕：主角在旧楼发现异常。 第二幕：规则逐步失效。");
  });

  it("falls back to the worldview when no story outline was extracted", () => {
    expect(buildCraftMetaSummary({ worldview: "封闭社区遵循一套不能违背的夜间规则。" }))
      .toBe("封闭社区遵循一套不能违背的夜间规则。");
  });
});
