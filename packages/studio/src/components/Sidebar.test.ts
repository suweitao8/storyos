import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as SidebarModule from "./Sidebar";

describe("Sidebar create navigation items", () => {
  it("uses the full sidebar width like system items", () => {
    const CreateItem = (SidebarModule as typeof SidebarModule & {
      CreateItem?: React.ComponentType<{
        icon: React.ReactNode;
        label: string;
        active?: boolean;
        onClick: () => void;
      }>;
    }).CreateItem;

    expect(CreateItem).toBeDefined();

    const markup = renderToStaticMarkup(
      React.createElement(CreateItem!, {
        icon: React.createElement("span"),
        label: "短篇故事",
        active: true,
        onClick: () => {},
      }),
    );

    expect(markup).toContain("w-full");
    expect(markup).toContain("短篇故事");
  });
});
