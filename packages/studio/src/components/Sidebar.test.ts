import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as SidebarModule from "./Sidebar";

describe("sidebar navigation item alignment", () => {
  it("centers the item content without changing its label", () => {
    const SidebarItem = (SidebarModule as Record<string, unknown>).SidebarItem as React.ComponentType<{
      label: string;
      icon: React.ReactNode;
      active: boolean;
      onClick: () => void;
    }> | undefined;

    expect(SidebarItem).toBeDefined();
    if (!SidebarItem) return;

    const markup = renderToStaticMarkup(
      React.createElement(SidebarItem, {
        label: "设置",
        icon: React.createElement("span", null, "icon"),
        active: false,
        onClick: () => undefined,
      }),
    );

    expect(markup).toContain("justify-center");
    expect(markup).toContain("设置");
  });
});
