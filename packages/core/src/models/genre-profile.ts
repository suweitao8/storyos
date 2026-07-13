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
// Art styles
// ---------------------------------------------------------------------------

/**
 * Visual art style for image prompt generation.
 *
 * - `realistic`: Photorealistic / cinematic style — real materials, natural
 *   lighting, film-grade quality. Good for modern / urban / horror genres.
 * - `cg3d`: 3D Chinese animation (国漫) style — the look of shows like 凡人修仙传,
 *   rendered CGI characters with stylized but semi-realistic proportions,
 *   dramatic lighting, and a slightly painterly texture.
 */
export const ArtStyleSchema = z.enum(["realistic", "cg3d"]).default("realistic");
export type ArtStyle = z.infer<typeof ArtStyleSchema>;

export const ART_STYLES: ReadonlyArray<{
  readonly key: ArtStyle;
  readonly label: string;
  readonly labelEn: string;
}> = [
  { key: "realistic", label: "写实风格", labelEn: "Realistic" },
  { key: "cg3d", label: "3D国漫风格", labelEn: "3D Animation (国漫)" },
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
 *
 * Image templates are keyed by art style: each kind (character / scene / prop)
 * has both a `realistic` and `cg3d` variant. The genre's `artStyle` field
 * determines which variant is used at generation time.
 */
export const PromptTemplatesSchema = z.object({
  image: z
    .object({
      character: z
        .object({
          realistic: z.string().default(""),
          cg3d: z.string().default(""),
        })
        .default({ realistic: "", cg3d: "" }),
      scene: z
        .object({
          realistic: z.string().default(""),
          cg3d: z.string().default(""),
        })
        .default({ realistic: "", cg3d: "" }),
      prop: z
        .object({
          realistic: z.string().default(""),
          cg3d: z.string().default(""),
        })
        .default({ realistic: "", cg3d: "" }),
    })
    .default({ character: { realistic: "", cg3d: "" }, scene: { realistic: "", cg3d: "" }, prop: { realistic: "", cg3d: "" } }),
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
  artStyle: ArtStyleSchema,
  promptTemplates: PromptTemplatesSchema.default({ image: { character: { realistic: "", cg3d: "" }, scene: { realistic: "", cg3d: "" }, prop: { realistic: "", cg3d: "" } }, voice: {} }),
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
