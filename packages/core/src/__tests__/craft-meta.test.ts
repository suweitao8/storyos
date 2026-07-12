import { describe, expect, it } from "vitest";

import { buildCraftMetaSummary } from "../models/craft-profile.js";

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
