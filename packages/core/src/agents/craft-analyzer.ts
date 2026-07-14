import type { AgentContext } from "./base.js";
import { BaseAgent } from "./base.js";
import { buildCraftAnalysisSystemPrompt, buildCraftAnalysisUserPrompt } from "./craft-prompts.js";
import { deriveCraftBreakdownModules, normalizeCraftBreakdownModules } from "./craft-breakdown.js";
import { estimateVideoNovelWordCount } from "../craft/video-word-count.js";
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
  originalizationRules: ["originalizationRules", "originalityRules", "原创化规则", "原创化约束", "原创要求", "仿写约束", "改写规则"],
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
  const stripped = stripCodeFence(value)
    // Normalise smart/typographic quotes that LLMs commonly emit.
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    // Remove control characters that break JSON.parse.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Remove trailing commas before closing braces/brackets.
    .replace(/,\s*([}\]])/g, "$1");
  return insertMissingCommasBetweenObjects(stripped);
}

/**
 * Walk the JSON text outside of string values and insert a missing comma
 * wherever a `}` is directly followed by a `{` — a common LLM mistake when
 * listing exemplar objects.  Unlike a blanket regex, this preserves `}{`
 * patterns that legitimately appear inside string values.
 */
function insertMissingCommasBetweenObjects(value: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i]!;

    if (inString) {
      result += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }

    // Detect `}` followed by optional whitespace then `{` — insert a comma.
    if (ch === "}") {
      result += ch;
      let j = i + 1;
      while (j < value.length && /\s/.test(value[j]!)) j += 1;
      if (j < value.length && value[j] === "{") {
        result += ","; // insert the missing comma
      }
      continue;
    }

    result += ch;
  }

  return result;
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
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.endsWith("%")) {
      const percentage = Number(trimmed.slice(0, -1));
      if (Number.isFinite(percentage)) return Math.max(0, Math.min(1, percentage / 100));
    }
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number > 1 && number <= 100 ? number / 100 : number));
}

function videoKind(value: unknown): CraftBeatKind {
  const normalized = String(value ?? "other").trim();
  if (VIDEO_BEAT_KINDS.has(normalized)) return normalized as CraftBeatKind;
  const aliases: Record<string, CraftBeatKind> = {
    "开场钩子": "hook",
    "钩子": "hook",
    "设定": "setup",
    "诱发事件": "incitingIncident",
    "冲突": "conflict",
    "铺垫": "foreshadowing",
    "伏笔": "foreshadowing",
    "爽点": "payoff",
    "反转": "reversal",
    "假胜利": "falseVictory",
    "高潮": "climax",
    "结尾": "ending",
    "行动号召": "cta",
  };
  return aliases[normalized] ?? "other";
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

function isMissingVideoText(value: string): boolean {
  return !value.trim() || value.trim() === "未说明";
}

function parseVideoStory(raw: unknown): VideoStoryCraft | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const beats = videoObjectList(pickVideoValue(source, "beats"))
    .map((item, index): CraftBeat => ({
      order: Math.max(1, Number(item.order ?? item.index ?? index + 1) || index + 1),
      kind: videoKind(item.kind ?? item.type ?? item.类型),
      position: videoNumber(item.position ?? item.ratio ?? item.progress ?? item.位置 ?? item.比例 ?? item.进度 ?? item.时间点 ?? item.时间位置),
      ...(videoItemText(item, ["timeRange", "timestamp", "time", "时间段", "时间"]) ? {
        timeRange: videoItemText(item, ["timeRange", "timestamp", "time", "时间段", "时间"]),
      } : {}),
      event: videoItemText(item, ["event", "plot", "content", "description", "事件", "剧情", "剧情事件", "内容", "情节"]) || "未说明",
      function: videoItemText(item, ["function", "purpose", "narrativeFunction", "叙事功能", "功能", "作用", "叙事作用"]) || "未说明",
      emotionalEffect: videoItemText(item, ["emotionalEffect", "emotion", "emotionalImpact", "情绪效果", "情绪影响", "观众情绪", "情绪"]) || "未说明",
      ...(videoItemText(item, ["evidence", "clue", "证据", "依据"]) ? {
        evidence: videoItemText(item, ["evidence", "clue", "证据", "依据"]).slice(0, 100),
      } : {}),
    }))
    .sort((left, right) => left.position - right.position || left.order - right.order);

  const reversals = videoObjectList(pickVideoValue(source, "reversals"))
    .map((item, index): CraftReversal => ({
      order: Math.max(1, Number(item.order ?? item.index ?? index + 1) || index + 1),
      position: videoNumber(item.position ?? item.ratio ?? item.progress ?? item.位置 ?? item.比例 ?? item.进度 ?? item.时间点 ?? item.时间位置),
      trigger: videoItemText(item, ["trigger", "cause", "触发", "触发条件", "触发点"]) || "未说明",
      apparentTruth: videoItemText(item, ["apparentTruth", "setupTruth", "表面真相", "表面认知", "原先认知"]) || "未说明",
      reveal: videoItemText(item, ["reveal", "truth", "揭示", "真相", "反转内容"]) || "未说明",
      reinterpretedClues: videoItemText(item, ["reinterpretedClues", "clues", "线索重释", "线索回收", "重新解释的线索"]) || "未说明",
      emotionalEffect: videoItemText(item, ["emotionalEffect", "emotion", "情绪效果", "情绪影响", "观众情绪", "情绪"]) || "未说明",
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
      position: videoNumber(item.position ?? item.ratio ?? item.progress ?? item.位置 ?? item.比例 ?? item.进度 ?? item.时间点 ?? item.时间位置),
      setup: videoItemText(item, ["setup", "plant", "铺垫", "前置铺垫"]) || "未说明",
      release: videoItemText(item, ["release", "payoff", "爽点", "释放"]) || "未说明",
      costOrConsequence: videoItemText(item, ["costOrConsequence", "consequence", "cost", "代价", "后果"]) || "未说明",
      emotionalEffect: videoItemText(item, ["emotionalEffect", "emotion", "情绪效果", "情绪影响", "观众情绪", "情绪"]) || "未说明",
    }))
    .sort((left, right) => left.position - right.position || left.order - right.order);

  const originalizationRulesValue = pickVideoValue(source, "originalizationRules");
  const parsedOriginalizationRules = Array.isArray(originalizationRulesValue)
    ? originalizationRulesValue.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim())
    : typeof originalizationRulesValue === "string" && originalizationRulesValue.trim()
      ? [originalizationRulesValue.trim()]
      : [];
  const originalizationRules = parsedOriginalizationRules.length > 0
    ? parsedOriginalizationRules
    : [
        "重新设计人物身份、关系、地点和叙述视角，不沿用原视频专有名词。",
        "重新设计因果链、规则机制、场面细节和结尾，只迁移节拍功能、相对位置与情绪间距。",
        "不得复用原视频的连续事件顺序、独特对白或可识别表达。",
      ];

  const normalizedReversals = reversals.map((reversal) => {
    const setupBeatOrders = reversal.setupBeatOrders.length >= 2
      ? reversal.setupBeatOrders
      : beats.filter((beat) => beat.position < reversal.position).slice(-2).map((beat) => beat.order);
    const setupBeats = setupBeatOrders
      .map((order) => beats.find((beat) => beat.order === order))
      .filter((beat): beat is CraftBeat => Boolean(beat));
    const lastSetup = setupBeats[setupBeats.length - 1];
    const nextBeat = lastSetup
      ? beats.find((beat) => beat.order > lastSetup.order)
      : undefined;
    const inferredPosition = nextBeat?.position ?? lastSetup?.position ?? reversal.position;
    return {
      ...reversal,
      position: reversal.position > 0 ? reversal.position : inferredPosition,
      setupBeatOrders,
      trigger: isMissingVideoText(reversal.trigger)
        ? lastSetup?.event ?? "前置线索触发认知变化"
        : reversal.trigger,
      apparentTruth: isMissingVideoText(reversal.apparentTruth)
        ? lastSetup ? `${lastSetup.function}：${lastSetup.event}` : "观众根据前置线索形成的判断"
        : reversal.apparentTruth,
      reveal: isMissingVideoText(reversal.reveal)
        ? nextBeat?.event ?? lastSetup?.event ?? "前置判断被重新解释"
        : reversal.reveal,
      reinterpretedClues: isMissingVideoText(reversal.reinterpretedClues)
        ? `铺垫节拍 ${setupBeatOrders.join("、") || "未记录"} 在此处被重新解释`
        : reversal.reinterpretedClues,
      emotionalEffect: isMissingVideoText(reversal.emotionalEffect)
        ? nextBeat?.emotionalEffect ?? "认知翻转"
        : reversal.emotionalEffect,
    };
  });

  const payoffCandidates = beats.filter((beat) =>
    ["payoff", "falseVictory", "climax", "ending", "reversal"].includes(beat.kind),
  );
  const derivedPayoffs = payoffCandidates
    .filter((beat) => !payoffs.some((payoff) => Math.abs(payoff.position - beat.position) < 0.01))
    .map((beat, index): CraftPayoff => ({
      order: payoffs.length + index + 1,
      position: beat.position,
      setup: `在 ${Math.round(beat.position * 100)}% 前完成对应伏笔与压力积累。`,
      release: beat.event,
      costOrConsequence: "在新故事中重新设计选择代价与后果。",
      emotionalEffect: beat.emotionalEffect,
    }));
  const normalizedPayoffs = [...payoffs, ...derivedPayoffs].slice(0, 8).map((payoff) => {
    const beat = beats.reduce<CraftBeat | undefined>((closest, candidate) => {
      if (!closest) return candidate;
      return Math.abs(candidate.position - payoff.position) < Math.abs(closest.position - payoff.position)
        ? candidate
        : closest;
    }, undefined);
    return {
      ...payoff,
      setup: isMissingVideoText(payoff.setup)
        ? `在 ${Math.round(payoff.position * 100)}% 前完成 ${beat?.function ?? "线索与压力"} 的积累`
        : payoff.setup,
      release: isMissingVideoText(payoff.release)
        ? beat?.event ?? "情绪压力在此处释放"
        : payoff.release,
      costOrConsequence: isMissingVideoText(payoff.costOrConsequence)
        ? "该节点把故事推入下一层压力，具体代价需在新故事中重新设计"
        : payoff.costOrConsequence,
      emotionalEffect: isMissingVideoText(payoff.emotionalEffect)
        ? beat?.emotionalEffect ?? beat?.function ?? "情绪释放"
        : payoff.emotionalEffect,
    };
  });

  const firstBeat = beats[0];
  const lastBeat = beats[beats.length - 1];
  const climaxBeat = beats.find((beat) => ["climax", "reversal", "ending"].includes(beat.kind)) ?? lastBeat;
  const logline = videoText(source, "logline", "");
  const audiencePromise = videoText(source, "audiencePromise", "");
  const outline = videoText(source, "outline", "");
  const pacingCurve = videoText(source, "pacingCurve", "");
  const hookStrategy = videoText(source, "hookStrategy", "");
  const climaxStrategy = videoText(source, "climaxStrategy", "");
  const endingAftertaste = videoText(source, "endingAftertaste", "");

  return {
    logline: isMissingVideoText(logline)
      ? `${firstBeat?.event ?? "异常出现"}，最终发展为${lastBeat?.event ?? "新的悬念"}`
      : logline,
    audiencePromise: isMissingVideoText(audiencePromise)
      ? "以连续线索、认知反转和逐级升级维持观看张力"
      : audiencePromise,
    outline: isMissingVideoText(outline)
      ? beats.map((beat) => `${Math.round(beat.position * 100)}% ${beat.event}`).join("；").slice(0, 1200)
      : outline,
    beats,
    reversals: normalizedReversals,
    payoffs: normalizedPayoffs,
    pacingCurve: isMissingVideoText(pacingCurve)
      ? `开场 ${Math.round((firstBeat?.position ?? 0) * 100)}%；高潮/反转 ${Math.round((climaxBeat?.position ?? 0) * 100)}%；结尾 ${Math.round((lastBeat?.position ?? 1) * 100)}%`
      : pacingCurve,
    hookStrategy: isMissingVideoText(hookStrategy)
      ? `${firstBeat?.function ?? "先给出具体异常"}：${firstBeat?.event ?? "先展示异常，再解释背景"}`
      : hookStrategy,
    climaxStrategy: isMissingVideoText(climaxStrategy)
      ? `${climaxBeat?.function ?? "通过反转释放压力"}：${climaxBeat?.event ?? "在高压节点完成认知翻转"}`
      : climaxStrategy,
    endingAftertaste: isMissingVideoText(endingAftertaste)
      ? `${lastBeat?.event ?? "留下新的线索"}，让已闭合的问题继续产生余波`
      : endingAftertaste,
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

const SOURCE_EXEMPLAR_MIN_LENGTH = 300;
const SOURCE_EXEMPLAR_MAX_LENGTH = 500;

/** Build verbatim fallback excerpts when the model omits optional examples. */
function buildSourceBackedExemplars(sourceText: string): CraftProfile["exemplars"] {
  const units: string[] = [];
  for (const rawLine of sourceText.split(/\r?\n/u)) {
    const line = rawLine.trimEnd();
    const content = line
      .replace(/^\s*\[[^\]]+\]\s*/u, "")
      .replace(/^\s*---.*---\s*$/u, "")
      .replace(/^\s*第[一二三四五六七八九十百千零0-9]+[章节回卷].*$/u, "")
      .trim();
    if (!content) continue;

    if (line.length <= SOURCE_EXEMPLAR_MAX_LENGTH) {
      units.push(line);
      continue;
    }
    for (let offset = 0; offset < line.length; offset += SOURCE_EXEMPLAR_MIN_LENGTH) {
      units.push(line.slice(offset, offset + SOURCE_EXEMPLAR_MIN_LENGTH));
    }
  }

  const chunks: string[] = [];
  let current = "";
  const pushCurrent = () => {
    if (current.length > 50) chunks.push(current);
    current = "";
  };

  for (const unit of units) {
    const candidate = current ? `${current}\n${unit}` : unit;
    if (current && current.length >= SOURCE_EXEMPLAR_MIN_LENGTH && candidate.length > SOURCE_EXEMPLAR_MAX_LENGTH) {
      pushCurrent();
      current = unit;
    } else if (candidate.length <= SOURCE_EXEMPLAR_MAX_LENGTH) {
      current = candidate;
    } else {
      pushCurrent();
      current = unit;
    }
  }
  pushCurrent();

  const expandedChunks = chunks.map((chunk) => {
    if (chunk.length >= SOURCE_EXEMPLAR_MIN_LENGTH) return chunk;
    const end = sourceText.lastIndexOf(chunk) + chunk.length;
    const start = Math.max(0, end - SOURCE_EXEMPLAR_MIN_LENGTH);
    const expanded = sourceText.slice(start, end);
    return expanded.length >= SOURCE_EXEMPLAR_MIN_LENGTH ? expanded : chunk;
  });
  if (expandedChunks.length === 0) return [];
  const indexes = expandedChunks.length <= 4
    ? expandedChunks.map((_, index) => index)
    : [0, Math.round((expandedChunks.length - 1) / 3), Math.round((expandedChunks.length - 1) * 2 / 3), expandedChunks.length - 1];
  const uniqueIndexes = [...new Set(indexes)];
  const labels = ["开场钩子", "冲突推进", "线索与反转", "高潮与余韵"];
  const tones = ["紧张", "压迫", "惊疑", "高潮/余韵"];
  return uniqueIndexes.map((index, position) => ({
    label: labels[position] ?? `代表片段 ${position + 1}`,
    tone: tones[position] ?? "代表性",
    excerpt: expandedChunks[index]!,
  }));
}

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

  const sectionExemplars = [
    { label: "结构手法", tone: "代表片段", excerpt: validatedStructure.exemplar },
    { label: "场景与节奏", tone: "代表片段", excerpt: validatedSceneRhythm.exemplar },
    { label: "信息披露", tone: "代表片段", excerpt: validatedInformationDisclosure.exemplar },
    { label: "叙事视角", tone: "代表片段", excerpt: validatedNarrativePerspective.exemplar },
  ].filter((item): item is CraftProfile["exemplars"][number] =>
    typeof item.excerpt === "string" && item.excerpt.length > 50,
  );
  const fallbackExemplars = validExemplars.length > 0
    ? validExemplars
    : sectionExemplars.length > 0
      ? sectionExemplars
      : buildSourceBackedExemplars(sourceText).slice(0, 6);

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
    sourceDurationSeconds?: number,
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
      const remainingWeakFields = collectWeakCraftFields(profile, language);
      if (remainingWeakFields.length > 0) {
        this.log?.warn(
          `[craft] refinement still has ${remainingWeakFields.length} unspecified technique fields: ${remainingWeakFields.map((field) => `${field.section}.${field.key}`).join(", ")}`,
        );
      }
    }
    onProgress?.(language === "zh" ? "校验范例片段…" : "Validating exemplars…");
    const validated = validateExemplars(profile, text);
    const validEvidenceCount = validated.modules?.filter((module) => module.evidence).length ?? 0;
    onProgress?.(
      language === "zh"
        ? `已完成 ${validated.modules?.length ?? 0} 个拆文模块和 ${validated.exemplars.length} 个范例校验（有效证据 ${validEvidenceCount} 个）`
        : `Validated ${validated.modules?.length ?? 0} modules and ${validated.exemplars.length} exemplars (${validEvidenceCount} evidence excerpts)`,
    );
    if (sourceType !== "bilibili" || !validated.videoStory) return validated;
    return {
      ...validated,
      videoStory: {
        ...validated.videoStory,
        wordCountEstimate: estimateVideoNovelWordCount(
          text,
          mode,
          sourceDurationSeconds,
          language,
        ),
      },
    };
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
    const value = this.findCraftFieldValue(raw, field);
    if (value) return value;

    this.log?.info(`[craft] first-pass field '${field.key}' is missing; it will be refined from the source excerpts`);
    return CRAFT_SECTION_FALLBACKS[language];
  }

  private findCraftFieldValue(
    raw: Record<string, unknown>,
    field: CraftFieldSpec,
  ): string | undefined {
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
    return undefined;
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
          "Preserve any valid modules, exemplars, exemplar, and evidence fields from the previous output; do not clear them merely to shorten the JSON.",
          "If an optional excerpt cannot be preserved verbatim, omit only that invalid excerpt rather than clearing all other valid examples.",
        ]
      : [
          "上一次修复仍然不是合法 JSON。",
          `只返回包含${requiredSectionsZh}个必需 section（鬼故事模式必须包含 ghostStory）及其必需字段的紧凑对象。`,
          "保留上一轮输出中合法的 modules、exemplars、exemplar 和 evidence 字段，不要为了压缩 JSON 而全部清空。",
          "如果某个可选片段无法逐字保留，只省略这个无效片段，不要清空其他有效范例。",
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
          "Return one valid JSON patch containing only the sections and fields listed for rewriting.",
          "Do not repeat or regenerate modules, exemplars, video beats, or unrelated sections unless they are explicitly listed.",
          "Rewrite vague fields into concrete, evidence-based craft descriptions grounded in the excerpts.",
          "Do not use placeholders such as \"Not specified\", \"Unknown\", or \"N/A\".",
          "If the pattern is implicit, infer the dominant technique from repeated evidence.",
          "Keep strong fields and valid exemplar text unless you can make them more precise without changing meaning.",
          ...(sourceType === "bilibili" ? ["If videoStory is incomplete, expand it to 8-14 beats, 2-5 reversals, and 3-8 payoffs with normalized positions and originalizationRules."] : []),
          "Output JSON only.",
        ].join("\n")
      : [
          "你负责精炼一份从小说节选中提取出来的写作模式。",
          "只返回一个合法 JSON 补丁对象，只包含下面列出的待重写 section 和字段。",
          "不要重复生成 modules、exemplars、视频节拍或未列出的 section，避免覆盖已有结果。",
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
          "## Fields That Must Be Rewritten",
          weakFieldList,
        ].join("\n")
      : [
          "## 参考文本节选",
          "",
          sample,
          "",
          "## 必须重写的字段（只返回这些字段所在的 section）",
          weakFieldList,
        ].join("\n");

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 8192 },
    );

    const refinedPayload = await this.parseRefinementPatch(response.content, language, mode, sourceType);
    return this.mergeRefinementPatch(profile, refinedPayload, weakFields, language, videoNeedsRefine);
  }

  private async parseRefinementPatch(
    raw: string,
    language: "zh" | "en",
    mode: CraftMode,
    sourceType: "bilibili" | "novel",
  ): Promise<Record<string, unknown>> {
    const jsonPayload = extractFirstJSONObject(raw);
    if (!jsonPayload) throw new Error("Craft refinement did not return valid JSON");
    return unwrapCraftProfilePayload(await this.parseProfileObject(jsonPayload, language, mode, sourceType));
  }

  private mergeRefinementPatch(
    profile: CraftProfile,
    patch: Record<string, unknown>,
    weakFields: ReadonlyArray<WeakCraftField>,
    language: "zh" | "en",
    videoNeedsRefine: boolean,
  ): CraftProfile {
    const weakSections = new Set(weakFields.map((field) => field.section));
    const mergeSection = (
      current: Record<string, unknown>,
      section: keyof typeof CRAFT_SECTION_SPECS,
    ): Record<string, unknown> => {
      if (!weakSections.has(section)) return current;
      const raw = pickCraftTopLevelValue(patch, section);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return current;

      const next = { ...current };
      for (const field of CRAFT_SECTION_SPECS[section]) {
        const value = this.findCraftFieldValue(raw as Record<string, unknown>, field);
        if (value && !isWeakCraftValue(value, language)) next[field.key] = value;
      }
      const exemplar = (raw as Record<string, unknown>).exemplar;
      if (typeof exemplar === "string" && exemplar.trim()) next.exemplar = exemplar.trim();
      return next;
    };

    const structure = mergeSection(profile.structure as unknown as Record<string, unknown>, "structure");
    const sceneRhythm = mergeSection(profile.sceneRhythm as unknown as Record<string, unknown>, "sceneRhythm");
    const informationDisclosure = mergeSection(profile.informationDisclosure as unknown as Record<string, unknown>, "informationDisclosure");
    const narrativePerspective = mergeSection(profile.narrativePerspective as unknown as Record<string, unknown>, "narrativePerspective");
    const ghostStory = profile.ghostStory && weakSections.has("ghostStory")
      ? mergeSection(
        profile.ghostStory as unknown as Record<string, unknown>,
        "ghostStory",
      )
      : undefined;

    const refinedWorldview = pickCraftTopLevelText(patch, "worldview");
    const refinedStoryOutline = pickCraftTopLevelText(patch, "storyOutline");
    const worldview = refinedWorldview && !isWeakCraftValue(refinedWorldview, language)
      ? refinedWorldview
      : profile.worldview;
    const storyOutline = refinedStoryOutline && !isWeakCraftValue(refinedStoryOutline, language)
      ? refinedStoryOutline
      : profile.storyOutline;

    let videoStory: VideoStoryCraft | undefined;
    if (videoNeedsRefine && profile.videoStory) {
      const refinedVideoStory = parseVideoStory(pickCraftTopLevelValue(patch, "videoStory"));
      if (refinedVideoStory) {
        videoStory = {
          ...profile.videoStory,
          ...refinedVideoStory,
          beats: refinedVideoStory.beats.length > 0 ? refinedVideoStory.beats : profile.videoStory.beats,
          reversals: refinedVideoStory.reversals.length > 0 ? refinedVideoStory.reversals : profile.videoStory.reversals,
          payoffs: refinedVideoStory.payoffs.length > 0 ? refinedVideoStory.payoffs : profile.videoStory.payoffs,
          originalizationRules: refinedVideoStory.originalizationRules.length > 0
            ? refinedVideoStory.originalizationRules
            : profile.videoStory.originalizationRules,
        };
      }
    }

    return {
      ...profile,
      structure: structure as unknown as CraftStructure,
      sceneRhythm: sceneRhythm as unknown as CraftSceneRhythm,
      informationDisclosure: informationDisclosure as unknown as CraftInformationDisclosure,
      narrativePerspective: narrativePerspective as unknown as CraftNarrativePerspective,
      ...(ghostStory ? { ghostStory: ghostStory as unknown as GhostStoryCraft } : {}),
      ...(worldview ? { worldview } : {}),
      ...(storyOutline ? { storyOutline } : {}),
      ...(videoStory ? { videoStory } : {}),
    };
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
