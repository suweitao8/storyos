export const STORY_SEED_SECTION_DEFINITIONS = [
  { key: "title", zh: "故事名称", en: "Story title" },
  { key: "genreTone", zh: "类型与基调", en: "Genre and tone" },
  { key: "hook", zh: "一句话故事钩子", en: "One-line story hook" },
  { key: "worldview", zh: "世界观与运行规则", en: "Worldview and rules" },
  { key: "characters", zh: "角色与关系", en: "Characters and relationships" },
  { key: "conflict", zh: "核心冲突、代价与 stakes", en: "Core conflict, stakes, and cost" },
  { key: "outline", zh: "分段故事大纲", en: "Beat outline" },
  { key: "reversals", zh: "关键反转与线索回收", en: "Key reversals and clue payoffs" },
  { key: "ending", zh: "结局与情绪余味", en: "Ending and emotional aftertaste" },
  { key: "visualAudioMotifs", zh: "画面与声音母题", en: "Visual and audio motifs" },
] as const;

export type StorySeedSectionKey = typeof STORY_SEED_SECTION_DEFINITIONS[number]["key"];

export interface StorySeed {
  readonly title: string;
  readonly genreTone: string;
  readonly hook: string;
  readonly worldview: string;
  readonly characters: string;
  readonly conflict: string;
  readonly outline: string;
  readonly reversals: string;
  readonly ending: string;
  readonly visualAudioMotifs: string;
}

export class StorySeedParseError extends Error {
  readonly missingSections: ReadonlyArray<StorySeedSectionKey>;

  constructor(missingSections: ReadonlyArray<StorySeedSectionKey>) {
    super(`Story seed is missing required sections: ${missingSections.join(", ")}`);
    this.name = "StorySeedParseError";
    this.missingSections = missingSections;
  }
}

const SECTION_KEY_BY_LABEL = new Map<string, StorySeedSectionKey>(
  STORY_SEED_SECTION_DEFINITIONS.flatMap((definition) => [
    [definition.zh, definition.key],
    [definition.en, definition.key],
    ...(definition.key === "conflict" ? [["核心冲突、代价与后果", definition.key] as const] : []),
  ]),
);

function stripMarkdownFence(markdown: string): string {
  return markdown
    .trim()
    .replace(/^```(?:markdown|md|text)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
}

function normalizeSectionLabel(label: string): string {
  return label.trim().replace(/[：:]+$/u, "");
}

export function parseStorySeed(markdown: string): StorySeed {
  const source = stripMarkdownFence(markdown);
  const headings = Array.from(source.matchAll(/^##\s+(.+?)\s*$/gmu));
  const values = new Map<StorySeedSectionKey, string>();

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const label = normalizeSectionLabel(heading[1] ?? "");
    const key = SECTION_KEY_BY_LABEL.get(label);
    if (!key) continue;
    const contentStart = (heading.index ?? 0) + heading[0].length;
    const contentEnd = headings[index + 1]?.index ?? source.length;
    const value = source.slice(contentStart, contentEnd).trim();
    if (value) values.set(key, value);
  }

  const missingSections = STORY_SEED_SECTION_DEFINITIONS
    .map((definition) => definition.key)
    .filter((key) => !values.get(key));
  if (missingSections.length > 0) throw new StorySeedParseError(missingSections);

  return {
    title: values.get("title")!,
    genreTone: values.get("genreTone")!,
    hook: values.get("hook")!,
    worldview: values.get("worldview")!,
    characters: values.get("characters")!,
    conflict: values.get("conflict")!,
    outline: values.get("outline")!,
    reversals: values.get("reversals")!,
    ending: values.get("ending")!,
    visualAudioMotifs: values.get("visualAudioMotifs")!,
  };
}

export function serializeStorySeed(seed: StorySeed, language: "zh" | "en" = "zh"): string {
  return STORY_SEED_SECTION_DEFINITIONS
    .map((definition) => `## ${language === "en" ? definition.en : definition.zh}\n${seed[definition.key]}`)
    .join("\n\n");
}
