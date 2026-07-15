import { describe, expect, it } from "vitest";
import { isShortSidebarItemActive, isStudioNavigationPageVisible } from "./sidebar-navigation-state";

describe("isShortSidebarItemActive", () => {
  it("highlights short story on the short-story routes", () => {
    expect(isShortSidebarItemActive("short", undefined)).toBe(true);
    expect(isShortSidebarItemActive("short:story-1", undefined)).toBe(true);
    expect(isShortSidebarItemActive("chat", "short")).toBe(false);
    expect(isShortSidebarItemActive("craft", "short")).toBe(false);
  });

  it("does not highlight another session kind", () => {
    expect(isShortSidebarItemActive("chat", "project")).toBe(false);
    expect(isShortSidebarItemActive("chat", undefined)).toBe(false);
  });
});

describe("isStudioNavigationPageVisible", () => {
  it("hides import and radar from the primary navigation", () => {
    expect(isStudioNavigationPageVisible("import")).toBe(false);
    expect(isStudioNavigationPageVisible("radar")).toBe(false);
  });

  it("keeps supported primary pages visible", () => {
    expect(isStudioNavigationPageVisible("craft")).toBe(true);
  });
});
