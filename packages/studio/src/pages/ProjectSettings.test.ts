import { describe, expect, it } from "vitest";

import { PROJECT_SETTINGS_TAB_IDS } from "./ProjectSettings";

describe("project settings resource tabs", () => {
  it("merges models into common tab", () => {
    expect(PROJECT_SETTINGS_TAB_IDS).toEqual([
      "common",
      "genres",
      "diagnostics",
    ]);
  });
});
