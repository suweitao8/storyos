export interface GenreListItem {
  readonly id: string;
  readonly language: "zh" | "en";
  readonly source: "project" | "builtin";
}

export function filterGenresForLanguage<T extends GenreListItem>(
  genres: ReadonlyArray<T>,
  lang: "zh" | "en",
): ReadonlyArray<T> {
  return genres.filter((genre) => genre.language === lang || genre.source === "project");
}
