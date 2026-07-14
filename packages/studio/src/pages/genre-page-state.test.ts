import { describe, expect, it } from "vitest";
import { filterGenresForLanguage, getGenreListDisplayName } from "./genre-page-state";

describe("filterGenresForLanguage", () => {
  it("keeps the current language and all project overrides", () => {
    const genres = [
      { id: "zh-builtin", language: "zh", source: "builtin" },
      { id: "en-builtin", language: "en", source: "builtin" },
      { id: "project-en", language: "en", source: "project" },
    ] as const;

    expect(filterGenresForLanguage(genres, "zh")).toEqual([
      genres[0],
      genres[2],
    ]);
  });

  it("uses only the genre name for the selectable list label", () => {
    expect(getGenreListDisplayName({ name: "悬疑" })).toBe("悬疑");
  });
});
