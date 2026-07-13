import { describe, expect, it } from "vitest";
import { QUICK_ACTION_COMMANDS } from "./QuickActions";

describe("QuickActions", () => {
  it("does not expose the hidden market radar action", () => {
    expect(QUICK_ACTION_COMMANDS).not.toContain("scan market trends");
    expect(QUICK_ACTION_COMMANDS).toContain("export book");
  });
});
