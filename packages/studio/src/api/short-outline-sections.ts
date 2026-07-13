export interface ShortOutlineSection {
  readonly file: string;
  readonly title: string;
  readonly content: string;
}

const LEVEL_TWO_HEADING = /^##\s+(.+?)\s*$/gm;

/**
 * Turns the generated short-fiction plan into cards without changing the
 * source markdown. The generator intentionally keeps one canonical outline;
 * the Studio API exposes its level-two sections as separate display units.
 */
export function splitShortOutlineSections(markdown: string, sourceFile: string): ShortOutlineSection[] {
  const normalized = markdown.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const headings = [...normalized.matchAll(LEVEL_TWO_HEADING)];
  if (headings.length === 0) {
    return [{ file: sourceFile, title: "故事提纲", content: normalized }];
  }

  return headings.flatMap((match, index) => {
    const title = match[1]?.trim();
    if (!title || match.index === undefined) return [];
    const bodyStart = match.index + match[0].length;
    const bodyEnd = headings[index + 1]?.index ?? normalized.length;
    const content = normalized.slice(bodyStart, bodyEnd).replace(/^\s*---\s*$/gm, "").trim();
    if (!content) return [];
    return [{
      file: `${sourceFile}#section-${index + 1}`,
      title,
      content,
    }];
  });
}
