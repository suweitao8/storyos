import { describe, expect, it } from "vitest";
import { buildSecretSnapshot, resolveSingleModel } from "./service-config-card-state";

describe("resolveSingleModel", () => {
  it("resolves a single available model and keeps the only choice selected", () => {
    expect(resolveSingleModel(
      { defaultModel: "Kimi K2.6", models: ["Kimi K2.6"] },
      "",
      "gpt-image-2",
    )).toBe("Kimi K2.6");
  });
});

describe("buildSecretSnapshot", () => {
  it("treats a masked key snapshot as unchanged until the user types a new key", () => {
    expect(buildSecretSnapshot({
      service: "kkaiapi",
      model: "gpt-image-2",
      apiKey: "********",
    })).not.toBe(buildSecretSnapshot({
      service: "kkaiapi",
      model: "gpt-image-2",
      apiKey: "sk-new",
    }));
  });
});
