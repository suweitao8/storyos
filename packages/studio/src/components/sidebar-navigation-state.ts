export function isShortSidebarItemActive(activePage: string, sessionKind?: string): boolean {
  return activePage === "chat" && sessionKind === "short";
}
