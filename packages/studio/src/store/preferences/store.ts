import { create } from "zustand";
import type { PreferencesStore, SettingsGroup } from "./types";

// Same storage convention as the theme preference (`inkos:studio:theme`).
export const TOOL_DETAILS_STORAGE_KEY = "inkos:studio:tool-details-default-open";
export const SETTINGS_COLLAPSED_STORAGE_KEY = "inkos:studio:settings-collapsed-groups";

interface PreferenceStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getPreferenceStorage(): PreferenceStorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Default is `true` (keep today's behavior: result details start expanded).
 * Only an explicitly stored "false" turns the preference off.
 */
export function readStoredToolDetailsDefaultOpen(
  storage: Pick<PreferenceStorageLike, "getItem"> | null | undefined,
): boolean {
  return storage?.getItem(TOOL_DETAILS_STORAGE_KEY) !== "false";
}

const VALID_SETTINGS_GROUPS: ReadonlySet<SettingsGroup> = new Set(["common", "advanced", "diagnostics"]);

/**
 * Default: the "common" group is expanded, "advanced" and "diagnostics" start
 * collapsed. A stored value (if parseable) overrides the default.
 */
export function readStoredSettingsCollapsedGroups(
  storage: Pick<PreferenceStorageLike, "getItem"> | null | undefined,
): ReadonlySet<SettingsGroup> {
  const raw = storage?.getItem(SETTINGS_COLLAPSED_STORAGE_KEY);
  if (!raw) return new Set<SettingsGroup>(["advanced", "diagnostics"]);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<SettingsGroup>(["advanced", "diagnostics"]);
    const valid = parsed.filter((v): v is SettingsGroup => typeof v === "string" && VALID_SETTINGS_GROUPS.has(v as SettingsGroup));
    return new Set<SettingsGroup>(valid);
  } catch {
    return new Set<SettingsGroup>(["advanced", "diagnostics"]);
  }
}

export const usePreferencesStore = create<PreferencesStore>()((set, get) => ({
  toolDetailsDefaultOpen: readStoredToolDetailsDefaultOpen(getPreferenceStorage()),

  setToolDetailsDefaultOpen: (open: boolean) => {
    try {
      getPreferenceStorage()?.setItem(TOOL_DETAILS_STORAGE_KEY, String(open));
    } catch {
      // Ignore storage failures (e.g. private mode) and keep the in-memory
      // preference for this session — same policy as the theme preference.
    }
    set({ toolDetailsDefaultOpen: open });
  },

  settingsCollapsedGroups: readStoredSettingsCollapsedGroups(getPreferenceStorage()),

  toggleSettingsGroup: (group: SettingsGroup) => {
    const current = new Set(get().settingsCollapsedGroups);
    if (current.has(group)) current.delete(group);
    else current.add(group);
    try {
      getPreferenceStorage()?.setItem(SETTINGS_COLLAPSED_STORAGE_KEY, JSON.stringify([...current]));
    } catch {
      // Ignore storage failures — keep the in-memory preference for this session.
    }
    set({ settingsCollapsedGroups: current });
  },
}));
