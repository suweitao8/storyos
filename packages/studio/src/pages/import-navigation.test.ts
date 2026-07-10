import { describe, expect, it } from "vitest";

import { IMPORT_TABS } from "./ImportManager";

describe("import navigation", () => {
  it("keeps all import workflows available in the shared toolbar", () => {
    expect(IMPORT_TABS).toEqual(["chapters", "canon", "fanfic", "spinoff"]);
  });
});
