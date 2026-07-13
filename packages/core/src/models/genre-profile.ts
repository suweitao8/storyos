import { z } from "zod";
import yaml from "js-yaml";

// ---------------------------------------------------------------------------
// Voice age × gender groups
// ---------------------------------------------------------------------------

/**
 * Eight age-group × gender buckets used for voice prompt templates.
 * A genre may override the default voice prompt for any (or all) of these.
 */
export const VoiceAgeGroupSchema = z.enum([
  "boy", // 男孩
  "girl", // 女孩
  "youngMale", // 男青年
  "youngFemale", // 女青年
  "middleMale", // 中年男性
  "middleFemale", // 中年女性
  "elderMale", // 老年男性
  "elderFemale", // 老年女性
]);
export type VoiceAgeGroup = z.infer<typeof VoiceAgeGroupSchema>;

export const VOICE_AGE_GROUP_KEYS: ReadonlyArray<VoiceAgeGroup> = [
  "boy",
  "girl",
  "youngMale",
  "youngFemale",
  "middleMale",
  "middleFemale",
  "elderMale",
  "elderFemale",
];

/** Display labels for the eight voice age groups (zh / en). */
export const VOICE_AGE_GROUPS: ReadonlyArray<{
  readonly key: VoiceAgeGroup;
  readonly label: string;
  readonly labelEn: string;
}> = [
  { key: "boy", label: "男孩", labelEn: "Boy" },
  { key: "girl", label: "女孩", labelEn: "Girl" },
  { key: "youngMale", label: "男青年", labelEn: "Young Male" },
  { key: "youngFemale", label: "女青年", labelEn: "Young Female" },
  { key: "middleMale", label: "中年男性", labelEn: "Middle-aged Male" },
  { key: "middleFemale", label: "中年女性", labelEn: "Middle-aged Female" },
  { key: "elderMale", label: "老年男性", labelEn: "Elderly Male" },
  { key: "elderFemale", label: "老年女性", labelEn: "Elderly Female" },
];

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

/**
 * Per-genre prompt templates for asset generation (image + voice).
 *
 * Every field defaults to an empty string. When empty, the runtime falls back
 * to the global default template (see `default-prompt-templates.ts`), so old
 * genre files that predate this feature keep working unchanged.
 */
export const PromptTemplatesSchema = z.object({
  image: z
    .object({
      character: z.string().default(""),
      scene: z.string().default(""),
      prop: z.string().default(""),
    })
    .default({ character: "", scene: "", prop: "" }),
  voice: z
    .object({
      boy: z.string().default(""),
      girl: z.string().default(""),
      youngMale: z.string().default(""),
      youngFemale: z.string().default(""),
      middleMale: z.string().default(""),
      middleFemale: z.string().default(""),
      elderMale: z.string().default(""),
      elderFemale: z.string().default(""),
    })
    .default({}),
});
export type PromptTemplates = z.infer<typeof PromptTemplatesSchema>;

/** Image prompt template kind, mirroring {@link StoryAssetKind}. */
export type ImagePromptKind = "character" | "scene" | "prop";

export const IMAGE_PROMPT_KINDS: ReadonlyArray<ImagePromptKind> = ["character", "scene", "prop"];

export const GenreProfileSchema = z.object({
  name: z.string(),
  id: z.string(),
  language: z.enum(["zh", "en"]).default("zh"),
  chapterTypes: z.array(z.string()),
  fatigueWords: z.array(z.string()),
  numericalSystem: z.boolean().default(false),
  powerScaling: z.boolean().default(false),
  eraResearch: z.boolean().default(false),
  pacingRule: z.string().default(""),
  satisfactionTypes: z.array(z.string()).default([]),
  auditDimensions: z.array(z.number()).default([]),
  promptTemplates: PromptTemplatesSchema.default({ image: { character: "", scene: "", prop: "" }, voice: {} }),
});

export type GenreProfile = z.infer<typeof GenreProfileSchema>;

export interface ParsedGenreProfile {
  readonly profile: GenreProfile;
  readonly body: string;
}

export function parseGenreProfile(raw: string): ParsedGenreProfile {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error("Genre profile missing YAML frontmatter (--- ... ---)");
  }

  const frontmatter = yaml.load(fmMatch[1]) as Record<string, unknown>;
  const profile = GenreProfileSchema.parse(frontmatter);
  const body = fmMatch[2].trim();

  return { profile, body };
}
