import { describe, expect, it } from "vitest";

import { PROJECT_SETTINGS_RESOURCE_TABLES, PROJECT_SETTINGS_TAB_IDS } from "./ProjectSettings";

describe("project settings resource tabs", () => {
  it("keeps low-frequency genre and skill tables together inside settings", () => {
    expect(PROJECT_SETTINGS_TAB_IDS).toEqual([
      "common",
      "resources",
      "diagnostics",
    ]);
    expect(PROJECT_SETTINGS_RESOURCE_TABLES).toEqual(["genres", "skills"]);
  });
});
