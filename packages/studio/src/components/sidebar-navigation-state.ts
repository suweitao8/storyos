export function isShortSidebarItemActive(activePage: string, sessionKind?: string): boolean {
  void sessionKind;
  return activePage === "short" || activePage.startsWith("short:");
}

const HIDDEN_STUDIO_NAV_PAGES = new Set(["import", "radar"]);

export function isStudioNavigationPageVisible(page: string): boolean {
  return !HIDDEN_STUDIO_NAV_PAGES.has(page);
}
