import type { AgentContext } from "./base.js";
import { BaseAgent } from "./base.js";
import { buildCraftAnalysisSystemPrompt, buildCraftAnalysisUserPrompt } from "./craft-prompts.js";
import type {
  CraftProfile,
  CraftStructure,
  CraftSceneRhythm,
  CraftInformationDisclosure,
  CraftNarrativePerspective,
} from "../models/craft-profile.js";

// ---------------------------------------------------------------------------
// Chapter splitting (rule-based, no LLM)
// ---------------------------------------------------------------------------

const CHAPTER_RE = /第[一二三四五六七八九十百千零0-9]+[章节回卷]/g;

interface ChapterSegment {
  readonly title: string;
  readonly body: string;
}

/** Split raw text into chapters by Chinese chapter markers. */
export function splitCraftChapters(text: string): ChapterSegment[] {
  const matches = [...text.matchAll(CHAPTER_RE)];
  if (matches.length === 0) return [{ title: "(全文)", body: text }];

  const segments: ChapterSegment[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index!;
    const title = matches[i][0];
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const body = text.slice(start + title.length, end).trim();
    if (body) segments.push({ title, body });
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Sampling strategy
// ---------------------------------------------------------------------------

/** Chapter indices to sample for analysis: golden 3 + spaced milestones. */
const SAMPLE_INDICES = [0, 1, 2, 9, 19, 29, 49, 79, 99];

/**
 * Select representative chapters from the first N chapters.
 * Takes golden chapters (1/2/3) plus spaced milestones (10/20/30/50/80/100).
 * Falls back to evenly distributed chapters when fewer are available.
 */
export function selectSampleChapters(
  chapters: ReadonlyArray<ChapterSegment>,
  maxChapters = 100,
): ChapterSegment[] {
  const pool = chapters.slice(0, maxChapters);
  if (pool.length === 0) return [];

  const selected: ChapterSegment[] = [];
  const seen = new Set<number>();

  // First pass: pick by predefined indices
  for (const idx of SAMPLE_INDICES) {
    if (idx < pool.length && !seen.has(idx)) {
      selected.push(pool[idx]);
      seen.add(idx);
    }
  }

  // Fallback: if we got fewer than 3, distribute evenly
  if (selected.length < 3 && pool.length > 0) {
    const step = Math.max(1, Math.floor(pool.length / 5));
    for (let i = 0; i < pool.length && selected.length < 5; i += step) {
      if (!seen.has(i)) {
        selected.push(pool[i]);
        seen.add(i);
      }
    }
  }

  return selected;
}

/** Truncate each chapter body to a max character count to control sample size. */
function truncateChapters(
  chapters: ReadonlyArray<ChapterSegment>,
  maxCharsPerChapter = 4000,
): string {
  return chapters
    .map((ch) => {
      const header = `--- ${ch.title} ---\n`;
      const body = ch.body.length > maxCharsPerChapter
        ? ch.body.slice(0, maxCharsPerChapter) + "…"
        : ch.body;
      return header + body;
    })
    .join("\n\n");
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function extractFirstJSONObject(value: string): string | null {
  const text = stripCodeFence(value);
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const ch = text[index]!;

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function sanitizeCraftJSON(value: string): string {
  return stripCodeFence(value)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/}\s*{/g, "},{");
}

// ---------------------------------------------------------------------------
// Exemplar validation
// ---------------------------------------------------------------------------

/**
 * Verify that each exemplar excerpt is a verbatim substring of the original text.
 * Excerpts that fail validation are dropped (not silently kept).
 */
export function validateExemplars(
  profile: CraftProfile,
  sourceText: string,
): CraftProfile {
  // Normalize: remove whitespace differences for more forgiving matching
  const normalized = sourceText.replace(/\s+/g, "");
  const validExemplars = profile.exemplars.filter((ex) => {
    const normalizedExcerpt = ex.excerpt.replace(/\s+/g, "");
    return normalizedExcerpt.length > 50 && normalized.includes(normalizedExcerpt);
  });

  // Also validate per-section exemplars
  const validateSection = <T extends { exemplar?: string }>(section: T): T => {
    if (!section.exemplar) return section;
    const normalizedExcerpt = section.exemplar.replace(/\s+/g, "");
    if (normalizedExcerpt.length <= 50 || !normalized.includes(normalizedExcerpt)) {
      const { exemplar: _, ...rest } = section;
      return rest as T;
    }
    return section;
  };

  return {
    ...profile,
    structure: validateSection(profile.structure),
    sceneRhythm: validateSection(profile.sceneRhythm),
    informationDisclosure: validateSection(profile.informationDisclosure),
    narrativePerspective: validateSection(profile.narrativePerspective),
    exemplars: validExemplars,
  };
}

// ---------------------------------------------------------------------------
// Craft analyzer agent
// ---------------------------------------------------------------------------

export class CraftAnalyzerAgent extends BaseAgent {
  get name(): string {
    return "craft-analyzer";
  }

  /**
   * Analyze a reference novel and produce a CraftProfile.
   *
   * @param text Full reference text (can be up to ~1M characters)
   * @param sourceName Name of the source work
   * @param language Output language
   * @param onProgress Optional progress callback
   */
  async analyze(
    text: string,
    sourceName: string,
    language: "zh" | "en",
    onProgress?: (message: string) => void,
  ): Promise<CraftProfile> {
    onProgress?.(language === "zh" ? "分割章节…" : "Splitting chapters…");
    const chapters = splitCraftChapters(text);

    onProgress?.(
      language === "zh"
        ? `已分割 ${chapters.length} 章,选取代表性章节…`
        : `Split ${chapters.length} chapters, selecting samples…`,
    );
    const sampleChapters = selectSampleChapters(chapters);
    const sample = truncateChapters(sampleChapters);

    onProgress?.(language === "zh" ? "分析写作手法…" : "Analyzing writing craft…");
    const systemPrompt = buildCraftAnalysisSystemPrompt(language);
    const userPrompt = buildCraftAnalysisUserPrompt(sample, language);

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 8192 },
    );

    const profile = await this.parseProfile(response.content, sourceName, language);
    onProgress?.(language === "zh" ? "校验范例片段…" : "Validating exemplars…");

    return validateExemplars(profile, text);
  }

  private async parseProfile(
    raw: string,
    sourceName: string,
    language: "zh" | "en",
  ): Promise<CraftProfile> {
    const jsonPayload = extractFirstJSONObject(raw);
    if (!jsonPayload) {
      throw new Error("Craft analysis did not return valid JSON");
    }

    const parsed = await this.parseProfileObject(jsonPayload, language);

    return {
      sourceName,
      analyzedAt: new Date().toISOString(),
      language,
      structure: this.parseSection(parsed.structure, [
        "openingPattern",
        "chapterArc",
        "endingHookType",
      ]) as unknown as CraftStructure,
      sceneRhythm: this.parseSection(parsed.sceneRhythm, [
        "sceneTransitionTechnique",
        "pacingCurve",
        "conflictEscalation",
      ]) as unknown as CraftSceneRhythm,
      informationDisclosure: this.parseSection(parsed.informationDisclosure, [
        "foreshadowingDensity",
        "informationReleaseRhythm",
        "suspenseManagement",
      ]) as unknown as CraftInformationDisclosure,
      narrativePerspective: this.parseSection(parsed.narrativePerspective, [
        "povStrategy",
        "narrationDialogueRatio",
        "narrativeDistance",
      ]) as unknown as CraftNarrativePerspective,
      exemplars: this.parseExemplars(parsed.exemplars),
    };
  }

  private parseSection(
    raw: unknown,
    requiredFields: ReadonlyArray<string>,
  ): Record<string, unknown> {
    if (!raw || typeof raw !== "object") {
      throw new Error(`Invalid craft section: ${JSON.stringify(raw)}`);
    }
    const obj = raw as Record<string, unknown>;
    for (const field of requiredFields) {
      if (typeof obj[field] !== "string" || !obj[field]) {
        throw new Error(`Missing required field '${field}' in craft section`);
      }
    }
    const result: Record<string, unknown> = { ...obj };
    if (typeof obj.exemplar === "string" && obj.exemplar) {
      result.exemplar = obj.exemplar;
    }
    return result;
  }

  private async parseProfileObject(
    raw: string,
    language: "zh" | "en",
  ): Promise<Record<string, unknown>> {
    const candidates = [raw, sanitizeCraftJSON(raw)];
    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
        lastError = new Error("Craft analysis JSON root must be an object");
      } catch (error) {
        lastError = error;
      }
    }

    const repaired = await this.repairMalformedProfileJSON(raw, language, lastError);
    const repairedPayload = extractFirstJSONObject(repaired) ?? repaired;

    try {
      const parsed = JSON.parse(sanitizeCraftJSON(repairedPayload)) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      throw new Error("Craft analysis JSON root must be an object");
    } catch (error) {
      throw new Error(`Craft analysis JSON parse error: ${String(error)}`);
    }
  }

  private async repairMalformedProfileJSON(
    raw: string,
    language: "zh" | "en",
    parseError: unknown,
  ): Promise<string> {
    this.log?.warn(`[craft] repairing malformed JSON after parse error: ${String(parseError)}`);
    const systemPrompt = language === "en"
      ? [
          "You repair malformed JSON emitted by another model.",
          "Return one valid JSON object only.",
          "Do not add commentary, markdown fences, or new fields.",
          "Preserve the original keys and string values as much as possible.",
          "Only fix JSON syntax issues such as missing commas, trailing commas, or broken escaping.",
        ].join("\n")
      : [
          "你是 JSON 修复器，负责修复另一个模型输出的损坏 JSON。",
          "只返回一个合法 JSON 对象。",
          "不要输出说明、不要加 markdown 代码块、不要新增字段。",
          "尽量保留原有的键和值内容。",
          "只修复 JSON 语法问题，例如漏逗号、多余逗号或转义损坏。",
        ].join("\n");
    const userPrompt = language === "en"
      ? `Fix the malformed JSON below and return valid JSON only:\n\n${raw}`
      : `请修复下面这段损坏的 JSON，并且只返回合法 JSON：\n\n${raw}`;
    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0, maxTokens: 8192 },
    );
    return response.content;
  }

  private parseExemplars(raw: unknown): CraftProfile["exemplars"] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
      )
      .map((item) => ({
        label: String(item.label ?? ""),
        tone: String(item.tone ?? ""),
        excerpt: String(item.excerpt ?? ""),
      }))
      .filter((ex) => ex.label && ex.excerpt);
  }
}
