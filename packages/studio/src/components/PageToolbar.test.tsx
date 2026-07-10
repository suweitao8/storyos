import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PageToolbar, type PageToolbarTab } from "./PageToolbar";

type ChildProps = { children?: React.ReactNode };
type ButtonProps = ChildProps & { onClick?: () => void };

const tabs: PageToolbarTab[] = [
  { id: "overview", label: "Overview" },
  { id: "settings", label: "Settings" },
];

describe("PageToolbar", () => {
  it("renders the title and all provided toolbar regions", () => {
    const markup = renderToStaticMarkup(
      <PageToolbar
        title="Project"
        leading={<span>Back</span>}
        actions={<button type="button">Save</button>}
        globalActions={<button type="button">More</button>}
        className="custom-toolbar"
      />,
    );

    expect(markup).toContain("Project");
    expect(markup).toContain("Back");
    expect(markup).toContain("Save");
    expect(markup).toContain("More");
    expect(markup).toContain("custom-toolbar");
  });

  it("renders an accessible, horizontally scrollable tab navigation", () => {
    const markup = renderToStaticMarkup(
      <PageToolbar tabs={tabs} activeTab="overview" onTabChange={vi.fn()} />,
    );

    expect(markup).toContain('aria-label="页面导航"');
    expect(markup).toContain('data-testid="page-toolbar-tabs"');
    expect(markup).toContain("overflow-x-auto");
  });

  it("marks the active tab with page semantics and the primary underline", () => {
    const markup = renderToStaticMarkup(
      <PageToolbar tabs={tabs} activeTab="settings" onTabChange={vi.fn()} />,
    );

    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("text-primary");
    expect(markup).toContain("border-primary");
    expect(markup).not.toContain('aria-current="false"');
  });

  it("calls onTabChange with the selected tab id", () => {
    const onTabChange = vi.fn();
    const toolbar = PageToolbar({ tabs, activeTab: "overview", onTabChange });
    const navigation = React.Children.toArray(toolbar.props.children).find(
      (child): child is React.ReactElement<ChildProps> => React.isValidElement(child) && child.type === "nav",
    );

    if (!navigation) {
      throw new Error("Expected PageToolbar to render tab navigation");
    }

    const tabsContainer = navigation.props.children;
    if (!React.isValidElement<ChildProps>(tabsContainer)) {
      throw new Error("Expected PageToolbar to render a tab container");
    }

    const tabRow = tabsContainer.props.children;
    if (!React.isValidElement<ChildProps>(tabRow)) {
      throw new Error("Expected PageToolbar to render a tab row");
    }

    const tabButtons = React.Children.toArray(tabRow.props.children);
    const settingsTab = tabButtons[1];
    if (!React.isValidElement<ButtonProps>(settingsTab)) {
      throw new Error("Expected PageToolbar to render a settings tab");
    }

    settingsTab.props.onClick?.();

    expect(onTabChange).toHaveBeenCalledWith("settings");
  });
});
