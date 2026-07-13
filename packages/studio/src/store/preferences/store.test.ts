import { describe, it, expect, beforeEach } from "vitest";
import {
  readStoredToolDetailsDefaultOpen,
  readStoredSettingsCollapsedGroups,
  usePreferencesStore,
  TOOL_DETAILS_STORAGE_KEY,
  SETTINGS_COLLAPSED_STORAGE_KEY,
} from "./store";

function fakeStorage(entries: Record<string, string>) {
  return {
    getItem: (key: string) => (key in entries ? entries[key] : null),
  };
}

describe("readStoredToolDetailsDefaultOpen", () => {
  it("defaults to true when no storage is available", () => {
    expect(readStoredToolDetailsDefaultOpen(null)).toBe(true);
    expect(readStoredToolDetailsDefaultOpen(undefined)).toBe(true);
  });

  it("defaults to true when nothing is stored", () => {
    expect(readStoredToolDetailsDefaultOpen(fakeStorage({}))).toBe(true);
  });

  it("returns false only for an explicitly stored \"false\"", () => {
    expect(readStoredToolDetailsDefaultOpen(fakeStorage({ [TOOL_DETAILS_STORAGE_KEY]: "false" }))).toBe(false);
    expect(readStoredToolDetailsDefaultOpen(fakeStorage({ [TOOL_DETAILS_STORAGE_KEY]: "true" }))).toBe(true);
    expect(readStoredToolDetailsDefaultOpen(fakeStorage({ [TOOL_DETAILS_STORAGE_KEY]: "garbage" }))).toBe(true);
  });
});

describe("readStoredSettingsCollapsedGroups", () => {
  it("defaults to advanced + diagnostics collapsed when nothing is stored", () => {
    const groups = readStoredSettingsCollapsedGroups(fakeStorage({}));
    expect(groups.has("advanced")).toBe(true);
    expect(groups.has("diagnostics")).toBe(true);
    expect(groups.has("common")).toBe(false);
  });

  it("defaults to advanced + diagnostics when storage is unavailable", () => {
    const groups = readStoredSettingsCollapsedGroups(null);
    expect([...groups].sort()).toEqual(["advanced", "diagnostics"]);
  });

  it("parses a stored JSON array of group names", () => {
    const groups = readStoredSettingsCollapsedGroups(
      fakeStorage({ [SETTINGS_COLLAPSED_STORAGE_KEY]: JSON.stringify(["common"]) }),
    );
    expect(groups.has("common")).toBe(true);
    expect(groups.size).toBe(1);
  });

  it("ignores invalid entries and falls back to the default on unparseable JSON", () => {
    const groups = readStoredSettingsCollapsedGroups(
      fakeStorage({ [SETTINGS_COLLAPSED_STORAGE_KEY]: "not-json" }),
    );
    expect([...groups].sort()).toEqual(["advanced", "diagnostics"]);
  });

  it("filters out unknown group names", () => {
    const groups = readStoredSettingsCollapsedGroups(
      fakeStorage({ [SETTINGS_COLLAPSED_STORAGE_KEY]: JSON.stringify(["common", "bogus"]) }),
    );
    expect(groups.has("common")).toBe(true);
    expect(groups.has("bogus" as never)).toBe(false);
    expect(groups.size).toBe(1);
  });
});

describe("usePreferencesStore", () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      toolDetailsDefaultOpen: true,
      settingsCollapsedGroups: new Set(["advanced", "diagnostics"]),
    });
  });

  it("starts with details expanded by default", () => {
    expect(usePreferencesStore.getState().toolDetailsDefaultOpen).toBe(true);
  });

  it("setToolDetailsDefaultOpen updates the state", () => {
    usePreferencesStore.getState().setToolDetailsDefaultOpen(false);
    expect(usePreferencesStore.getState().toolDetailsDefaultOpen).toBe(false);

    usePreferencesStore.getState().setToolDetailsDefaultOpen(true);
    expect(usePreferencesStore.getState().toolDetailsDefaultOpen).toBe(true);
  });

  it("toggleSettingsGroup adds and removes a group from the collapsed set", () => {
    const store = usePreferencesStore.getState();
    // common starts expanded (not in collapsed set)
    expect(store.settingsCollapsedGroups.has("common")).toBe(false);

    store.toggleSettingsGroup("common");
    expect(usePreferencesStore.getState().settingsCollapsedGroups.has("common")).toBe(true);

    usePreferencesStore.getState().toggleSettingsGroup("common");
    expect(usePreferencesStore.getState().settingsCollapsedGroups.has("common")).toBe(false);
  });

  it("toggleSettingsGroup removes advanced from the collapsed set (expand it)", () => {
    usePreferencesStore.getState().toggleSettingsGroup("advanced");
    expect(usePreferencesStore.getState().settingsCollapsedGroups.has("advanced")).toBe(false);
  });
});
