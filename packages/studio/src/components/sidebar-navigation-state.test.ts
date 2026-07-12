import { describe, expect, it } from "vitest";
import { isShortSidebarItemActive } from "./sidebar-navigation-state";

describe("isShortSidebarItemActive", () => {
  it("highlights short story only on the chat route", () => {
    expect(isShortSidebarItemActive("chat", "short")).toBe(true);
    expect(isShortSidebarItemActive("craft", "short")).toBe(false);
  });

  it("does not highlight another session kind", () => {
    expect(isShortSidebarItemActive("chat", "project")).toBe(false);
    expect(isShortSidebarItemActive("chat", undefined)).toBe(false);
  });
});
