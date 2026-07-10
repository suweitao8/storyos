import { describe, expect, it } from "vitest";
import { parseBvid } from "./bilibili.js";

describe("Bilibili subtitle import helpers", () => {
  it("accepts a BV number or a full Bilibili video URL", () => {
    expect(parseBvid("BV1YBTb6sEEr")).toBe("BV1YBTb6sEEr");
    expect(parseBvid("https://www.bilibili.com/video/BV1YBTb6sEEr/?spm_id_from=333")).toBe("BV1YBTb6sEEr");
  });

  it("rejects arbitrary text and malformed BV numbers", () => {
    expect(parseBvid("not a bilibili link")).toBeNull();
    expect(parseBvid("https://example.com/video/BV1YBTb6sEEr")).toBeNull();
    expect(parseBvid("BV1YBTb6sEE")).toBeNull();
  });
});
