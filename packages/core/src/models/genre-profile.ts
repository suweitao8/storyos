import { z } from "zod";
import yaml from "js-yaml";

// ---------------------------------------------------------------------------
// Art styles
// ---------------------------------------------------------------------------

/**
 * Visual art style for image generation.
 *
 * - `realistic`: Photorealistic / cinematic style — real materials, natural
 *   lighting, film-grade quality. Good for modern / urban / horror genres.
 * - `cg3d`: 3D Chinese animation (国漫) style — the look of shows like 凡人修仙传,
 *   rendered CGI characters with stylized but semi-realistic proportions,
 *   dramatic lighting, and a slightly painterly texture.
 *
 * Each genre picks one style. The actual prompt templates and style
 * descriptions live in `default-prompt-templates.ts` as global defaults.
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
// Voice
// ---------------------------------------------------------------------------

// Voice prompts are now a single generic template (see DEFAULT_VOICE_PROMPT
// in default-prompt-templates.ts) driven by character assets at generation
// time, rather than fixed age-group × gender buckets.

/** Image prompt template kind. character/scene/prop mirror {@link StoryAssetKind};
 *  shot is a non-asset kind for storyboard image prompts. */
export type ImagePromptKind = "character" | "scene" | "prop" | "shot";

export const IMAGE_PROMPT_KINDS: ReadonlyArray<ImagePromptKind> = ["character", "scene", "prop", "shot"];

// ---------------------------------------------------------------------------
// Genre profile
// ---------------------------------------------------------------------------

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
