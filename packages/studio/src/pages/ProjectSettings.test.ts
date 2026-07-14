import { describe, expect, it } from "vitest";

import { PROJECT_SETTINGS_TAB_IDS } from "./ProjectSettings";

describe("project settings resource tabs", () => {
  it("keeps low-frequency skills and genres inside settings", () => {
    expect(PROJECT_SETTINGS_TAB_IDS).toEqual([
      "common",
      "models",
      "skills",
      "genres",
      "diagnostics",
    ]);
  });
});
