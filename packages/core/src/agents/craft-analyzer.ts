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
  CraftMode,
  GhostStoryCraft,
  CraftBeat,
  CraftBeatKind,
  CraftReversal,
  CraftPayoff,
  VideoStoryCraft,
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
  ghostStory: [
    { key: "fearCore", aliases: ["\u6050\u60e7\u6838\u5fc3", "fear", "fearSource", "horrorCore"] },
    { key: "supernaturalRules", aliases: ["\u8d85\u81ea\u7136\u89c4\u5219", "supernaturalRule", "entityRules", "ghostRules"] },
    { key: "taboos", aliases: ["\u7981\u5fcc", "\u7981\u5fcc\u4e0e\u89e6\u53d1\u6761\u4ef6", "triggers", "tabooRules"] },
    { key: "protagonistVulnerability", aliases: ["\u4e3b\u89d2\u8106\u5f31\u70b9", "protagonistWeakness", "vulnerability"] },
    { key: "clueSystem", aliases: ["\u7ebf\u7d22\u7cfb\u7edf", "clues", "evidenceChain", "clueChain"] },
    { key: "revealCadence", aliases: ["\u771f\u76f8\u63ed\u793a\u8282\u594f", "\u63ed\u793a\u8282\u594f", "revealRhythm", "revelation"] },
    { key: "scareCadence", aliases: ["\u60ca\u5413\u8282\u594f", "scareRhythm", "scarePattern"] },
    { key: "escalationLadder", aliases: ["\u6050\u6016\u5347\u7ea7\u9636\u68af", "horrorEscalation", "escalation"] },
    { key: "sensoryMotifs", aliases: ["\u611f\u5b98\u6bcd\u9898", "sensoryMotif", "sensoryDetails", "motifs"] },
    { key: "endingAftertaste", aliases: ["\u7ed3\u5c3e\u4f59\u97f5", "endingAfterglow", "aftertaste", "endingEffect"] },
  ],
};

const VIDEO_STORY_ALIASES: Record<string, ReadonlyArray<string>> = {
  logline: ["logline", "premise", "一句话梗概", "核心命题"],
  audiencePromise: ["audiencePromise", "viewerPromise", "观看承诺", "受众承诺"],
  outline: ["outline", "videoOutline", "视频大纲", "视频故事大纲"],
  beats: ["beats", "storyBeats", "节拍", "剧情节拍", "时间线"],
  reversals: ["reversals", "turningPoints", "turns", "反转", "反转点", "剧情反转"],
  payoffs: ["payoffs", "releases", "爽点", "高潮回收", "情绪释放"],
  pacingCurve: ["pacingCurve", "rhythmCurve", "节奏曲线", "节奏"],
  hookStrategy: ["hookStrategy", "openingHook", "开场钩子", "钩子策略"],
  climaxStrategy: ["climaxStrategy", "高潮策略", "高潮设计"],
  endingAftertaste: ["endingAftertaste", "endingEffect", "结尾余韵", "结尾效果"],
  originalizationRules: ["originalizationRules", "originalityRules", "原创化规则", "仿写约束", "改写规则"],
};

const VIDEO_BEAT_KINDS: ReadonlySet<string> = new Set([
  "hook", "setup", "incitingIncident", "conflict", "foreshadowing", "payoff",
  "reversal", "falseVictory", "climax", "ending", "cta", "other",
]);

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
  worldview: ["worldview", "worldView", "world", "setting", "worldRules", "世界观", "世界设定", "世界规则", "背景设定"],
  storyOutline: ["storyOutline", "outline", "storySkeleton", "plotSkeleton", "故事大纲", "故事骨架", "情节骨架", "故事结构"],
  structure: ["structure", "结构", "结构手法", "开篇与结构", "故事结构"],
  sceneRhythm: ["sceneRhythm", "sceneAndRhythm", "场景与节奏", "场景节奏", "场景手法"],
  informationDisclosure: ["informationDisclosure", "informationRelease", "信息披露", "信息释放", "信息手法"],
  narrativePerspective: ["narrativePerspective", "narrativePOV", "叙事视角", "叙事", "视角手法"],
  ghostStory: ["ghostStory", "ghostCraft", "horrorCraft", "鬼故事模式", "恐怖机制", "恐怖故事手法"],
  modules: ["modules", "module", "breakdownModules", "拆文模块", "写作模块", "模块"],
  videoStory: ["videoStory", "videoCraft", "videoRhythm", "视频模式", "视频节奏", "视频拆解", "视频故事"],
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

function pickCraftTopLevelText(raw: Record<string, unknown>, key: string): string | undefined {
  const value = pickCraftTopLevelValue(raw, key);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const text = Object.values(value as Record<string, unknown>)
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return undefined;
}

function pickVideoValue(raw: Record<string, unknown>, key: string): unknown {
  return pickCraftObjectValue(raw, VIDEO_STORY_ALIASES[key] ?? [key]);
}

function videoText(raw: Record<string, unknown>, key: string, fallback: string): string {
  const value = pickVideoValue(raw, key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function videoNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number > 1 && number <= 100 ? number / 100 : number));
}

function videoKind(value: unknown): CraftBeatKind {
  const normalized = String(value ?? "other").trim();
  return VIDEO_BEAT_KINDS.has(normalized) ? normalized as CraftBeatKind : "other";
}

function videoObjectList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> =>
    typeof item === "object" && item !== null && !Array.isArray(item),
  );
}

function videoItemText(item: Record<string, unknown>, candidates: ReadonlyArray<string>): string {
  const value = pickCraftObjectValue(item, candidates);
  return typeof value === "string" ? value.trim() : "";
}

function parseVideoStory(raw: unknown): VideoStoryCraft | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const beats = videoObjectList(pickVideoValue(source, "beats"))
    .map((item, index): CraftBeat => ({
      order: Math.max(1, Number(item.order ?? item.index ?? index + 1) || index + 1),
      kind: videoKind(item.kind ?? item.type ?? item.类型),
      position: videoNumber(item.position ?? item.ratio ?? item.progress ?? item.位置),
      ...(videoItemText(item, ["timeRange", "timestamp", "time", "时间段", "时间"]) ? {
        timeRange: videoItemText(item, ["timeRange", "timestamp", "time", "时间段", "时间"]),
      } : {}),
      event: videoItemText(item, ["event", "plot", "事件", "剧情"]) || "未说明",
      function: videoItemText(item, ["function", "purpose", "narrativeFunction", "叙事功能", "作用"]) || "未说明",
      emotionalEffect: videoItemText(item, ["emotionalEffect", "emotion", "emotionalImpact", "情绪效果", "情绪"]) || "未说明",
      ...(videoItemText(item, ["evidence", "clue", "证据", "依据"]) ? {
        evidence: videoItemText(item, ["evidence", "clue", "证据", "依据"]).slice(0, 100),
      } : {}),
    }))
    .sort((left, right) => left.position - right.position || left.order - right.order);

  const reversals = videoObjectList(pickVideoValue(source, "reversals"))
    .map((item, index): CraftReversal => ({
      order: Math.max(1, Number(item.order ?? item.index ?? index + 1) || index + 1),
      position: videoNumber(item.position ?? item.ratio ?? item.progress ?? item.位置),
      trigger: videoItemText(item, ["trigger", "cause", "触发", "触发条件"]) || "未说明",
      apparentTruth: videoItemText(item, ["apparentTruth", "setupTruth", "表面真相", "原先认知"]) || "未说明",
      reveal: videoItemText(item, ["reveal", "truth", "揭示", "真相"]) || "未说明",
      reinterpretedClues: videoItemText(item, ["reinterpretedClues", "clues", "线索重释", "重新解释的线索"]) || "未说明",
      emotionalEffect: videoItemText(item, ["emotionalEffect", "emotion", "情绪效果", "情绪"]) || "未说明",
      setupBeatOrders: Array.isArray(item.setupBeatOrders)
        ? item.setupBeatOrders.map((value: unknown) => Number(value)).filter((value: number) => Number.isFinite(value))
        : Array.isArray(item.setupBeats)
          ? item.setupBeats.map((value: unknown) => Number(value)).filter((value: number) => Number.isFinite(value))
          : [],
    }))
    .sort((left, right) => left.position - right.position || left.order - right.order);

  const payoffs = videoObjectList(pickVideoValue(source, "payoffs"))
    .map((item, index): CraftPayoff => ({
      order: Math.max(1, Number(item.order ?? item.index ?? index + 1) || index + 1),
      position: videoNumber(item.position ?? item.ratio ?? item.progress ?? item.位置),
      setup: videoItemText(item, ["setup", "plant", "铺垫", "前置铺垫"]) || "未说明",
      release: videoItemText(item, ["release", "payoff", "爽点", "释放"]) || "未说明",
      costOrConsequence: videoItemText(item, ["costOrConsequence", "consequence", "cost", "代价", "后果"]) || "未说明",
      emotionalEffect: videoItemText(item, ["emotionalEffect", "emotion", "情绪效果", "情绪"]) || "未说明",
    }))
    .sort((left, right) => left.position - right.position || left.order - right.order);

  const originalizationRulesValue = pickVideoValue(source, "originalizationRules");
  const originalizationRules = Array.isArray(originalizationRulesValue)
    ? originalizationRulesValue.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim())
    : typeof originalizationRulesValue === "string" && originalizationRulesValue.trim()
      ? [originalizationRulesValue.trim()]
      : [];

  return {
    logline: videoText(source, "logline", "未说明"),
    audiencePromise: videoText(source, "audiencePromise", "未说明"),
    outline: videoText(source, "outline", "未说明"),
    beats,
    reversals,
    payoffs,
    pacingCurve: videoText(source, "pacingCurve", "未说明"),
    hookStrategy: videoText(source, "hookStrategy", "未说明"),
    climaxStrategy: videoText(source, "climaxStrategy", "未说明"),
    endingAftertaste: videoText(source, "endingAftertaste", "未说明"),
    originalizationRules,
  };
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
      case "ghostStory":
        return profile.ghostStory
          ? profile.ghostStory as unknown as Record<string, unknown>
          : {};
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
    mode: CraftMode = "general",
    sourceType: "bilibili" | "novel" = "novel",
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
    const systemPrompt = buildCraftAnalysisSystemPrompt(language, mode, sourceType);
    const userPrompt = buildCraftAnalysisUserPrompt(sample, language, mode, sourceType);

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 8192 },
    );

    let profile = await this.parseProfile(response.content, sourceName, language, undefined, mode, sourceType);
    onProgress?.(
      language === "zh"
        ? `首轮已提取 ${profile.modules?.length ?? 0} 个拆文模块，正在检查字段完整性…`
        : `First pass extracted ${profile.modules?.length ?? 0} breakdown modules; checking completeness…`,
    );
    const weakFields = collectWeakCraftFields(profile, language);
    const videoNeedsRefine = sourceType === "bilibili" && (
      !profile.videoStory
      || profile.videoStory.beats.length < 8
      || profile.videoStory.reversals.length < 2
      || profile.videoStory.payoffs.length < 3
    );
    if (weakFields.length > 0 || videoNeedsRefine) {
      onProgress?.(language === "zh" ? "补全不明确的技法字段…" : "Refining weak craft fields…");
      profile = await this.refineWeakCraftProfile(
        sample,
        sourceName,
        language,
        profile,
        weakFields,
        mode,
        sourceType,
        videoNeedsRefine,
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
    mode: CraftMode = "general",
    sourceType: "bilibili" | "novel" = "novel",
  ): Promise<CraftProfile> {
    const jsonPayload = extractFirstJSONObject(raw);
    if (!jsonPayload) {
      throw new Error("Craft analysis did not return valid JSON");
    }

    const parsed = await this.parseProfileObject(jsonPayload, language, mode, sourceType);

    const payload = unwrapCraftProfilePayload(parsed);
    const videoStory = parseVideoStory(pickCraftTopLevelValue(payload, "videoStory"));
    const baseProfile = {
      sourceName,
      analyzedAt: new Date().toISOString(),
      language,
      mode,
      ...(pickCraftTopLevelText(payload, "worldview") ? { worldview: pickCraftTopLevelText(payload, "worldview") } : {}),
      ...(pickCraftTopLevelText(payload, "storyOutline") ? { storyOutline: pickCraftTopLevelText(payload, "storyOutline") } : {}),
      structure: this.parseSection(pickCraftTopLevelValue(payload, "structure"), CRAFT_SECTION_SPECS.structure, language) as unknown as CraftStructure,
      sceneRhythm: this.parseSection(pickCraftTopLevelValue(payload, "sceneRhythm"), CRAFT_SECTION_SPECS.sceneRhythm, language) as unknown as CraftSceneRhythm,
      informationDisclosure: this.parseSection(pickCraftTopLevelValue(payload, "informationDisclosure"), CRAFT_SECTION_SPECS.informationDisclosure, language) as unknown as CraftInformationDisclosure,
      narrativePerspective: this.parseSection(pickCraftTopLevelValue(payload, "narrativePerspective"), CRAFT_SECTION_SPECS.narrativePerspective, language) as unknown as CraftNarrativePerspective,
      ...(mode === "ghost-story"
        ? { ghostStory: this.parseSection(pickCraftTopLevelValue(payload, "ghostStory") ?? {}, CRAFT_SECTION_SPECS.ghostStory, language) as unknown as GhostStoryCraft }
        : {}),
      ...(videoStory ? { videoStory } : {}),
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
    mode: CraftMode = "general",
    sourceType: "bilibili" | "novel" = "novel",
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

    let repairSource = raw;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const repaired = await this.repairMalformedProfileJSON(
        repairSource,
        language,
        lastError,
        attempt === 1,
        mode,
        sourceType,
      );
      const repairedPayload = extractFirstJSONObject(repaired) ?? repaired;

      try {
        const parsed = JSON.parse(sanitizeCraftJSON(repairedPayload)) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
        throw new Error("Craft analysis JSON root must be an object");
      } catch (error) {
        lastError = error;
        repairSource = repaired;
      }
    }

    throw new Error(`Craft analysis JSON parse error: ${String(lastError)}`);
  }

  private async repairMalformedProfileJSON(
    raw: string,
    language: "zh" | "en",
    parseError: unknown,
    compact = false,
    mode: CraftMode = "general",
    sourceType: "bilibili" | "novel" = "novel",
  ): Promise<string> {
    const requiredSections = mode === "ghost-story" ? "six" : "four";
    const requiredSectionsZh = mode === "ghost-story" ? "六个" : "四个";
    this.log?.warn(
      `[craft] repairing malformed JSON${compact ? " with compact fallback" : ""} after parse error: ${String(parseError)}`,
    );
    const compactRules = language === "en"
      ? [
          "The previous repair was still invalid JSON.",
          `Return a compact object with only the ${requiredSections} required sections${mode === "ghost-story" ? ", including the required ghostStory section" : ""}, and their required fields.`,
          "Use an empty modules array and an empty exemplars array if optional detail is unsafe to preserve.",
          "Keep each required value concise; omit optional exemplar and evidence fields.",
        ]
      : [
          "上一次修复仍然不是合法 JSON。",
          `只返回包含${requiredSectionsZh}个必需 section（鬼故事模式必须包含 ghostStory）及其必需字段的紧凑对象。`,
          "如果可选细节难以保留，将 modules 和 exemplars 设为空数组。",
          "每个必填值保持简短，省略可选的 exemplar 和 evidence 字段。",
        ];
    const systemPrompt = language === "en"
      ? [
          "You repair malformed JSON emitted by another model.",
          "Return one valid JSON object only.",
          "Do not add commentary, markdown fences, or new fields.",
          "Preserve the original keys and string values as much as possible.",
          "Only fix JSON syntax issues such as missing commas, trailing commas, or broken escaping.",
          ...(mode === "ghost-story" ? ["Preserve the required ghostStory object and all ten of its fields."] : []),
          ...(sourceType === "bilibili" ? ["Preserve the videoStory object when present, including beats, reversals, payoffs, and originalizationRules."] : []),
          ...(compact ? compactRules : []),
        ].join("\n")
      : [
          "你是 JSON 修复器，负责修复另一个模型输出的损坏 JSON。",
          "只返回一个合法 JSON 对象。",
          "不要输出说明、不要加 markdown 代码块、不要新增字段。",
          "尽量保留原有的键和值内容。",
          "只修复 JSON 语法问题，例如漏逗号、多余逗号或转义损坏。",
          ...(mode === "ghost-story" ? ["鬼故事模式必须保留 ghostStory 对象及其十个字段。"] : []),
          ...(compact ? compactRules : []),
        ].join("\n");
    const userPrompt = language === "en"
      ? `Fix the malformed JSON below and return valid JSON only:\n\n${raw}`
      : `请修复下面这段损坏的 JSON，并且只返回合法 JSON：\n\n${raw}`;
    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0, maxTokens: compact ? 4096 : 8192 },
    );
    return response.content;
  }

  private async refineWeakCraftProfile(
    sample: string,
    sourceName: string,
    language: "zh" | "en",
    profile: CraftProfile,
    weakFields: ReadonlyArray<WeakCraftField>,
    mode: CraftMode,
    sourceType: "bilibili" | "novel",
    videoNeedsRefine = false,
  ): Promise<CraftProfile> {
    const weakFieldList = [
      ...weakFields.map((field) => `- ${field.section}.${field.key}: ${field.value}`),
      ...(videoNeedsRefine ? ["- videoStory: expand the timestamp-aligned beats, reversals, payoffs, and originalizationRules"] : []),
    ]
      .join("\n");

    const systemPrompt = language === "en"
      ? [
          "You refine an extracted craft profile from novel excerpts.",
          "Return one valid JSON object with the exact same schema as the input profile.",
          "Rewrite vague fields into concrete, evidence-based craft descriptions grounded in the excerpts.",
          "Do not use placeholders such as \"Not specified\", \"Unknown\", or \"N/A\".",
          "If the pattern is implicit, infer the dominant technique from repeated evidence.",
          "Keep strong fields and valid exemplar text unless you can make them more precise without changing meaning.",
          ...(sourceType === "bilibili" ? ["If videoStory is incomplete, expand it to 8-14 beats, 2-5 reversals, and 3-8 payoffs with normalized positions and originalizationRules."] : []),
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

    const refined = await this.parseProfile(response.content, sourceName, language, profile.modules, mode, sourceType);
    const preserved = {
      ...refined,
      ...(refined.worldview ? {} : profile.worldview ? { worldview: profile.worldview } : {}),
      ...(refined.storyOutline ? {} : profile.storyOutline ? { storyOutline: profile.storyOutline } : {}),
    };
    if (refined.exemplars.length === 0 && profile.exemplars.length > 0) {
      return {
        ...preserved,
        exemplars: profile.exemplars,
      };
    }
    return preserved;
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
