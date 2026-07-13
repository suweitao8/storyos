export type SettingsGroup = "common" | "advanced" | "diagnostics";

export interface PreferencesStore {
  /**
   * Whether pipeline tool result blocks ("查看操作结果") in chat render
   * expanded by default. Persisted per browser via localStorage.
   */
  toolDetailsDefaultOpen: boolean;

  setToolDetailsDefaultOpen: (open: boolean) => void;

  /**
   * Which settings groups on the project settings page start collapsed.
   * Persisted per browser via localStorage. Default: advanced + diagnostics
   * collapsed, common expanded.
   */
  settingsCollapsedGroups: ReadonlySet<SettingsGroup>;

  toggleSettingsGroup: (group: SettingsGroup) => void;
}
