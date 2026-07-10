import type { AgentContext } from "./base.js";
import { BaseAgent } from "./base.js";
import { buildCraftAnalysisSystemPrompt, buildCraftAnalysisUserPrompt } from "./craft-prompts.js";
import { deriveCraftBreakdownModules, normalizeCraftBreakdownModules } from "./craft-breakdown.js";
import type {
  CraftProfile,
  CraftBreakdownModule,
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

interface CraftFieldSpec {
  readonly key: string;
  readonly aliases: readonly string[];
}

interface WeakCraftField {
  readonly section: keyof typeof CRAFT_SECTION_SPECS;
  readonly key: string;
  readonly value: string;
}

const CRAFT_SECTION_FALLBACKS: Record<string, string> = {
  zh: "未明确说明",
  en: "Not specified",
};

const CRAFT_SECTION_SPECS: Record<string, ReadonlyArray<CraftFieldSpec>> = {
  structure: [
    { key: "openingPattern", aliases: ["\u5f00\u7bc7\u6a21\u5f0f", "\u5f00\u573a\u6a21\u5f0f", "opening", "openingStyle", "openingTechnique"] },
    { key: "chapterArc", aliases: ["\u5355\u7ae0\u5f27\u7ebf", "\u7ae0\u8282\u5f27\u7ebf", "chapterStructure", "arc"] },
    { key: "endingHookType", aliases: ["\u7ae0\u672b\u94a9\u5b50", "\u6536\u5c3e\u94a9\u5b50", "endingHook", "hook"] },
  ],
  sceneRhythm: [
    { key: "sceneTransitionTechnique", aliases: ["\u573a\u666f\u5207\u6362", "\u573a\u666f\u8f6c\u6362", "sceneTransition"] },
    { key: "pacingCurve", aliases: ["\u8282\u594f\u66f2\u7ebf", "pacing"] },
    { key: "conflictEscalation", aliases: ["\u51b2\u7a81\u5347\u7ea7"] },
  ],
  informationDisclosure: [
    { key: "foreshadowingDensity", aliases: ["\u4f0f\u7b14\u5bc6\u5ea6", "\u4f0f\u7b14"] },
    { key: "informationReleaseRhythm", aliases: ["\u4fe1\u606f\u91ca\u653e", "\u4fe1\u606f\u8282\u594f"] },
    { key: "suspenseManagement", aliases: ["\u60ac\u5ff5\u7ba1\u7406"] },
  ],
  narrativePerspective: [
    { key: "povStrategy", aliases: ["POV\u7b56\u7565", "\u89c6\u89d2\u7b56\u7565", "\u53d9\u4e8b\u89c6\u89d2"] },
    { key: "narrationDialogueRatio", aliases: ["\u53d9\u8ff0/\u5bf9\u8bdd\u6bd4\u4f8b", "\u53d9\u8ff0\u5bf9\u8bdd\u6bd4\u4f8b", "\u53d9\u8ff0\u4e0e\u5bf9\u8bdd\u6bd4\u4f8b"] },
    { key: "narrativeDistance", aliases: ["\u53d9\u4e8b\u8ddd\u79bb"] },
  ],
};

const WEAK_CRAFT_PATTERNS: Record<"zh" | "en", ReadonlyArray<RegExp>> = {
  zh: [
    /^未明确说明$/u,
    /^不明确$/u,
    /^未提及$/u,
    /^未知$/u,
    /^无法判断$/u,
  ],
  en: [
    /^not specified$/iu,
    /^unknown$/iu,
    /^n\/a$/iu,
    /^not mentioned$/iu,
    /^unclear$/iu,
  ],
};

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

  for (const idx of SAMPLE_INDICES) {
    if (idx < pool.length && !seen.has(idx)) {
      selected.push(pool[idx]);
      seen.add(idx);
    }
  }

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

function normalizeCraftFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/giu, "");
}

const CRAFT_TOP_LEVEL_ALIASES: Record<string, ReadonlyArray<string>> = {
  structure: ["structure", "结构", "结构手法", "开篇与结构", "故事结构"],
  sceneRhythm: ["sceneRhythm", "sceneAndRhythm", "场景与节奏", "场景节奏", "场景手法"],
  informationDisclosure: ["informationDisclosure", "informationRelease", "信息披露", "信息释放", "信息手法"],
  narrativePerspective: ["narrativePerspective", "narrativePOV", "叙事视角", "叙事", "视角手法"],
  modules: ["modules", "module", "breakdownModules", "拆文模块", "写作模块", "模块"],
  exemplars: ["exemplars", "exemplar", "范例", "代表片段", "范例片段"],
};

function pickCraftObjectValue(
  raw: Record<string, unknown>,
  candidates: ReadonlyArray<string>,
): unknown {
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(raw)) {
    normalized.set(normalizeCraftFieldKey(key), value);
  }
  for (const candidate of candidates) {
    const value = normalized.get(normalizeCraftFieldKey(candidate));
    if (value !== undefined) return value;
  }
  return undefined;
}

function unwrapCraftProfilePayload(raw: Record<string, unknown>): Record<string, unknown> {
  let current = raw;
  const wrappers = ["craftProfile", "profile", "craft", "writingCraft", "写作模式", "写作手法", "拆文结果", "分析结果"];
  for (let depth = 0; depth < 2; depth += 1) {
    const nested = pickCraftObjectValue(current, wrappers);
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) break;
    current = nested as Record<string, unknown>;
  }
  return current;
}

function pickCraftTopLevelValue(raw: Record<string, unknown>, key: string): unknown {
  return pickCraftObjectValue(raw, CRAFT_TOP_LEVEL_ALIASES[key] ?? [key]);
}

function isWeakCraftValue(value: string, language: "zh" | "en"): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return WEAK_CRAFT_PATTERNS[language].some((pattern) => pattern.test(trimmed));
}

function validateCraftModuleEvidence(
  modules: ReadonlyArray<CraftBreakdownModule> | undefined,
  sourceText: string,
): ReadonlyArray<CraftBreakdownModule> | undefined {
  if (!modules) return modules;
  const normalizedSource = sourceText.replace(/\s+/g, "");
  return modules.map((module) => {
    if (!module.evidence) return module;
    const normalizedEvidence = module.evidence.replace(/\s+/g, "");
    if (normalizedEvidence.length > 50 && normalizedSource.includes(normalizedEvidence)) return module;
    const { evidence: _, ...withoutEvidence } = module;
    return withoutEvidence;
  });
}

function collectWeakCraftFields(
  profile: CraftProfile,
  language: "zh" | "en",
): WeakCraftField[] {
  type CraftSectionName = keyof typeof CRAFT_SECTION_SPECS;
  const getSectionValues = (section: CraftSectionName): Record<string, unknown> => {
    switch (section) {
      case "structure":
        return profile.structure as unknown as Record<string, unknown>;
      case "sceneRhythm":
        return profile.sceneRhythm as unknown as Record<string, unknown>;
      case "informationDisclosure":
        return profile.informationDisclosure as unknown as Record<string, unknown>;
      case "narrativePerspective":
        return profile.narrativePerspective as unknown as Record<string, unknown>;
      default:
        return {};
    }
  };

  const weakFields: WeakCraftField[] = [];

  for (const [section, specs] of Object.entries(CRAFT_SECTION_SPECS) as Array<
    [CraftSectionName, ReadonlyArray<CraftFieldSpec>]
  >) {
    const values = getSectionValues(section);
    for (const spec of specs) {
      const value = values[spec.key];
      if (typeof value === "string" && isWeakCraftValue(value, language)) {
        weakFields.push({ section, key: spec.key, value });
      }
    }
  }

  return weakFields;
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
  const normalized = sourceText.replace(/\s+/g, "");
  const validExemplars = profile.exemplars.filter((ex) => {
    const normalizedExcerpt = ex.excerpt.replace(/\s+/g, "");
    return normalizedExcerpt.length > 50 && normalized.includes(normalizedExcerpt);
  });

  const validateSection = <T extends { exemplar?: string }>(section: T): T => {
    if (!section.exemplar) return section;
    const normalizedExcerpt = section.exemplar.replace(/\s+/g, "");
    if (normalizedExcerpt.length <= 50 || !normalized.includes(normalizedExcerpt)) {
      const { exemplar: _, ...rest } = section;
      return rest as T;
    }
    return section;
  };

  const validatedStructure = validateSection(profile.structure);
  const validatedSceneRhythm = validateSection(profile.sceneRhythm);
  const validatedInformationDisclosure = validateSection(profile.informationDisclosure);
  const validatedNarrativePerspective = validateSection(profile.narrativePerspective);
  const validatedModules = validateCraftModuleEvidence(profile.modules, sourceText);

  const fallbackExemplars = validExemplars.length > 0
    ? validExemplars
    : [
        { label: "结构手法", tone: "代表片段", excerpt: validatedStructure.exemplar },
        { label: "场景与节奏", tone: "代表片段", excerpt: validatedSceneRhythm.exemplar },
        { label: "信息披露", tone: "代表片段", excerpt: validatedInformationDisclosure.exemplar },
        { label: "叙事视角", tone: "代表片段", excerpt: validatedNarrativePerspective.exemplar },
      ].filter((item): item is CraftProfile["exemplars"][number] =>
        typeof item.excerpt === "string" && item.excerpt.length > 50,
      );

  return {
    ...profile,
    structure: validatedStructure,
    sceneRhythm: validatedSceneRhythm,
    informationDisclosure: validatedInformationDisclosure,
    narrativePerspective: validatedNarrativePerspective,
    modules: validatedModules,
    exemplars: fallbackExemplars,
  };
}

// ---------------------------------------------------------------------------
// Craft analyzer agent
// ---------------------------------------------------------------------------

export class CraftAnalyzerAgent extends BaseAgent {
  get name(): string {
    return "craft-analyzer";
  }

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

    let profile = await this.parseProfile(response.content, sourceName, language);
    onProgress?.(
      language === "zh"
        ? `首轮已提取 ${profile.modules?.length ?? 0} 个拆文模块，正在检查字段完整性…`
        : `First pass extracted ${profile.modules?.length ?? 0} breakdown modules; checking completeness…`,
    );
    const weakFields = collectWeakCraftFields(profile, language);
    if (weakFields.length > 0) {
      onProgress?.(language === "zh" ? "补全不明确的技法字段…" : "Refining weak craft fields…");
      profile = await this.refineWeakCraftProfile(
        sample,
        sourceName,
        language,
        profile,
        weakFields,
      );
    }
    onProgress?.(language === "zh" ? "校验范例片段…" : "Validating exemplars…");
    const validated = validateExemplars(profile, text);
    const validEvidenceCount = validated.modules?.filter((module) => module.evidence).length ?? 0;
    onProgress?.(
      language === "zh"
        ? `已完成 ${validated.modules?.length ?? 0} 个拆文模块和 ${validated.exemplars.length} 个范例校验（有效证据 ${validEvidenceCount} 个）`
        : `Validated ${validated.modules?.length ?? 0} modules and ${validated.exemplars.length} exemplars (${validEvidenceCount} evidence excerpts)`,
    );
    return validated;
  }

  private async parseProfile(
    raw: string,
    sourceName: string,
    language: "zh" | "en",
    fallbackModules?: ReadonlyArray<CraftBreakdownModule>,
  ): Promise<CraftProfile> {
    const jsonPayload = extractFirstJSONObject(raw);
    if (!jsonPayload) {
      throw new Error("Craft analysis did not return valid JSON");
    }

    const parsed = await this.parseProfileObject(jsonPayload, language);

    const payload = unwrapCraftProfilePayload(parsed);
    const baseProfile = {
      sourceName,
      analyzedAt: new Date().toISOString(),
      language,
      structure: this.parseSection(pickCraftTopLevelValue(payload, "structure"), CRAFT_SECTION_SPECS.structure, language) as unknown as CraftStructure,
      sceneRhythm: this.parseSection(pickCraftTopLevelValue(payload, "sceneRhythm"), CRAFT_SECTION_SPECS.sceneRhythm, language) as unknown as CraftSceneRhythm,
      informationDisclosure: this.parseSection(pickCraftTopLevelValue(payload, "informationDisclosure"), CRAFT_SECTION_SPECS.informationDisclosure, language) as unknown as CraftInformationDisclosure,
      narrativePerspective: this.parseSection(pickCraftTopLevelValue(payload, "narrativePerspective"), CRAFT_SECTION_SPECS.narrativePerspective, language) as unknown as CraftNarrativePerspective,
      exemplars: this.parseExemplars(pickCraftTopLevelValue(payload, "exemplars")),
    } satisfies Omit<CraftProfile, "modules">;
    const modules = normalizeCraftBreakdownModules(pickCraftTopLevelValue(payload, "modules"));

    return {
      ...baseProfile,
      modules: modules.length > 0 ? modules : fallbackModules ?? deriveCraftBreakdownModules(baseProfile),
    };
  }

  private parseSection(
    raw: unknown,
    requiredFields: ReadonlyArray<CraftFieldSpec>,
    language: "zh" | "en",
  ): Record<string, unknown> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Invalid craft section: ${JSON.stringify(raw)}`);
    }

    const obj = raw as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const field of requiredFields) {
      result[field.key] = this.pickCraftFieldValue(obj, field, language);
    }

    if (typeof obj.exemplar === "string" && obj.exemplar.trim()) {
      result.exemplar = obj.exemplar;
    }
    return result;
  }

  private pickCraftFieldValue(
    raw: Record<string, unknown>,
    field: CraftFieldSpec,
    language: "zh" | "en",
  ): string {
    const lookup = new Map<string, string>();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value !== "string" || !value.trim()) continue;
      const normalizedKey = normalizeCraftFieldKey(key);
      if (!lookup.has(normalizedKey)) lookup.set(normalizedKey, value.trim());
    }

    for (const candidate of [field.key, ...field.aliases]) {
      const value = lookup.get(normalizeCraftFieldKey(candidate));
      if (value) return value;
    }

    this.log?.warn(`[craft] missing field '${field.key}', using fallback`);
    return CRAFT_SECTION_FALLBACKS[language];
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

  private async refineWeakCraftProfile(
    sample: string,
    sourceName: string,
    language: "zh" | "en",
    profile: CraftProfile,
    weakFields: ReadonlyArray<WeakCraftField>,
  ): Promise<CraftProfile> {
    const weakFieldList = weakFields
      .map((field) => `- ${field.section}.${field.key}: ${field.value}`)
      .join("\n");

    const systemPrompt = language === "en"
      ? [
          "You refine an extracted craft profile from novel excerpts.",
          "Return one valid JSON object with the exact same schema as the input profile.",
          "Rewrite vague fields into concrete, evidence-based craft descriptions grounded in the excerpts.",
          "Do not use placeholders such as \"Not specified\", \"Unknown\", or \"N/A\".",
          "If the pattern is implicit, infer the dominant technique from repeated evidence.",
          "Keep strong fields and valid exemplar text unless you can make them more precise without changing meaning.",
          "Output JSON only.",
        ].join("\n")
      : [
          "你负责精炼一份从小说节选中提取出来的写作模式。",
          "只返回一个合法 JSON 对象,并严格保持与输入 profile 相同的结构。",
          "把含糊或占位的字段改写成基于节选证据的具体技法描述。",
          "不要再输出“未明确说明”“未知”“N/A”之类的占位词。",
          "如果某种模式没有被原文直接点明,就根据重复出现的写法推断主导手法。",
          "已有足够具体的字段和有效范例尽量保留,只在能更准确时再改写。",
          "只输出 JSON,不要解释。",
        ].join("\n");

    const userPrompt = language === "en"
      ? [
          "## Reference Text Excerpts",
          "",
          sample,
          "",
          "## Current Profile JSON",
          "",
          JSON.stringify(profile, null, 2),
          "",
          "## Fields That Must Be Rewritten",
          weakFieldList,
        ].join("\n")
      : [
          "## 参考文本节选",
          "",
          sample,
          "",
          "## 当前写作模式 JSON",
          "",
          JSON.stringify(profile, null, 2),
          "",
          "## 必须重写的字段",
          weakFieldList,
        ].join("\n");

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 8192 },
    );

    const refined = await this.parseProfile(response.content, sourceName, language, profile.modules);
    if (refined.exemplars.length === 0 && profile.exemplars.length > 0) {
      return {
        ...refined,
        exemplars: profile.exemplars,
      };
    }
    return refined;
  }

  private parseExemplars(raw: unknown): CraftProfile["exemplars"] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
      )
      .map((item) => ({
        label: String(item.label ?? item.title ?? item.标签 ?? item.标题 ?? ""),
        tone: String(item.tone ?? item.基调 ?? item.情绪 ?? ""),
        excerpt: String(item.excerpt ?? item.text ?? item.content ?? item.原文 ?? item.片段 ?? item.证据 ?? ""),
      }))
      .filter((ex) => ex.label && ex.excerpt);
  }
}
