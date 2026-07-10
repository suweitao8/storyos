import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PageToolbar, type PageToolbarProps, type PageToolbarTab } from "./PageToolbar";

type ElementProps = { children?: React.ReactNode };
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ElementProps;

type StaticButton = {
  className: string;
  getAttribute: (name: "aria-current") => string | null;
  click: () => void;
};

type StaticToolbar = {
  markup: string;
  getByRole: (role: "button", options: { name: string }) => StaticButton;
};

const tabs: PageToolbarTab[] = [
  { id: "overview", label: "Overview" },
  { id: "settings", label: "Settings" },
];

function getTextContent(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (!React.isValidElement<ElementProps>(node)) {
    return "";
  }

  return React.Children.toArray(node.props.children).map(getTextContent).join("");
}

function findButtons(node: React.ReactNode): React.ReactElement<ButtonProps>[] {
  if (!React.isValidElement<ElementProps>(node)) {
    return [];
  }

  const buttons = node.type === "button" ? [node as React.ReactElement<ButtonProps>] : [];
  return [
    ...buttons,
    ...React.Children.toArray(node.props.children).flatMap(findButtons),
  ];
}

function renderStaticToolbar(props: PageToolbarProps): StaticToolbar {
  const renderedToolbar = PageToolbar(props);
  const markup = renderToStaticMarkup(React.createElement(PageToolbar, props));
  const buttons = findButtons(renderedToolbar);

  return {
    markup,
    getByRole(role, { name }) {
      if (role !== "button") {
        throw new Error(`Unsupported static role: ${role}`);
      }

      const button = buttons.find((candidate) => getTextContent(candidate.props.children) === name);
      if (!button) {
        throw new Error(`Button not found: ${name}`);
      }

      return {
        className: button.props.className ?? "",
        getAttribute(attribute) {
          const value = attribute === "aria-current" ? button.props[attribute] : undefined;
          return value == null ? null : String(value);
        },
        click() {
          if (typeof button.props.onClick !== "function") {
            throw new Error(`Button is not interactive: ${name}`);
          }

          button.props.onClick({} as React.MouseEvent<HTMLButtonElement>);
        },
      };
    },
  };
}

describe("PageToolbar", () => {
  it("renders the title and all provided toolbar regions", () => {
    const markup = renderStaticToolbar({
      title: "Project",
      leading: React.createElement("span", null, "Back"),
      actions: React.createElement("button", { type: "button" }, "Save"),
      globalActions: React.createElement("button", { type: "button" }, "More"),
      className: "custom-toolbar",
    }).markup;

    expect(markup).toContain("Project");
    expect(markup).toContain("Back");
    expect(markup).toContain("Save");
    expect(markup).toContain("More");
    expect(markup).toContain("custom-toolbar");
  });

  it("renders an accessible, horizontally scrollable tab navigation", () => {
    const markup = renderStaticToolbar({ tabs, activeTab: "overview", onTabChange: vi.fn() }).markup;

    expect(markup).toContain('aria-label="页面导航"');
    expect(markup).toContain('data-testid="page-toolbar-tabs"');
    expect(markup).toContain("overflow-x-auto");
  });

  it("applies active semantics and underline only to the Settings tab", () => {
    const view = renderStaticToolbar({ tabs, activeTab: "settings", onTabChange: vi.fn() });
    const settings = view.getByRole("button", { name: "Settings" });
    const overview = view.getByRole("button", { name: "Overview" });

    expect(settings.getAttribute("aria-current")).toBe("page");
    expect(settings.className).toContain("border-primary");
    expect(settings.className).toContain("border-b-2");
    expect(overview.getAttribute("aria-current")).toBeNull();
  });

  it("dispatches tab changes through the rendered button click contract", () => {
    const onTabChange = vi.fn();
    const view = renderStaticToolbar({ tabs, activeTab: "overview", onTabChange });

    view.getByRole("button", { name: "Settings" }).click();

    expect(onTabChange).toHaveBeenCalledWith("settings");
  });
});
