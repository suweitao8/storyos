export function isShortSidebarItemActive(activePage: string, sessionKind?: string): boolean {
  return activePage === "chat" && sessionKind === "short";
}

const HIDDEN_STUDIO_NAV_PAGES = new Set(["import", "radar"]);

export function isStudioNavigationPageVisible(page: string): boolean {
  return !HIDDEN_STUDIO_NAV_PAGES.has(page);
}
