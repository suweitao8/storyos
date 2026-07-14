/**
 * Writing craft profile extracted from a reference novel.
 *
 * Unlike StyleProfile (which captures surface-level textual statistics like
 * sentence length and rhetorical patterns), a CraftProfile captures the
 * *storytelling techniques* — how the reference author structures chapters,
 * paces scenes, discloses information, and manages narrative perspective.
 *
 * The profile is injected into the writer's system prompt so generated
 * chapters imitate the reference's craft, not just its prose style.
 */

/** A representative excerpt from the reference text, used as a few-shot example. */
export interface CraftExemplar {
  /** Label describing what technique this excerpt demonstrates. */
  readonly label: string;
  /** Emotional tone of the excerpt, e.g. "紧张" / "舒缓" / "高潮". */
  readonly tone: string;
  /** Verbatim excerpt from the reference text (300-500 chars). */
  readonly excerpt: string;
}

export type CraftMode =
  | "general"
  | "ghost-story"
  | "bilibili-short-story"
  | "bilibili-commentary";

/** Horror-specific controls required to reproduce a ghost-story experience. */
export interface GhostStoryCraft {
  readonly fearCore: string;
  readonly supernaturalRules: string;
  readonly taboos: string;
  readonly protagonistVulnerability: string;
  readonly clueSystem: string;
  readonly revealCadence: string;
  readonly scareCadence: string;
  readonly escalationLadder: string;
  readonly sensoryMotifs: string;
  readonly endingAftertaste: string;
}

/** A normalized story beat extracted from a timestamped video transcript. */
export type CraftBeatKind =
  | "hook"
  | "setup"
  | "incitingIncident"
  | "conflict"
  | "foreshadowing"
  | "payoff"
  | "reversal"
  | "falseVictory"
  | "climax"
  | "ending"
  | "cta"
  | "other";

export interface CraftBeat {
  readonly order: number;
  readonly kind: CraftBeatKind;
  /** Normalized source position between 0 and 1. */
  readonly position: number;
  readonly timeRange?: string;
  readonly event: string;
  readonly function: string;
  readonly emotionalEffect: string;
  /** A short evidence label or excerpt, never a long copied transcript. */
  readonly evidence?: string;
}

export interface CraftReversal {
  readonly order: number;
  readonly position: number;
  readonly trigger: string;
  readonly apparentTruth: string;
  readonly reveal: string;
  readonly reinterpretedClues: string;
  readonly emotionalEffect: string;
  readonly setupBeatOrders: ReadonlyArray<number>;
}

export interface CraftPayoff {
  readonly order: number;
  readonly position: number;
  readonly setup: string;
  readonly release: string;
  readonly costOrConsequence: string;
  readonly emotionalEffect: string;
}

export interface CraftWordCountEstimate {
  readonly recommended: number;
  /** Legacy fields retained for reading older saved craft profiles. */
  readonly min?: number;
  readonly max?: number;
  readonly sourceCharacterCount: number;
  readonly sourceDurationSeconds?: number;
  readonly rationale: string;
}

/** Video-only breakdown used to transfer narrative rhythm without copying expression. */
export interface VideoStoryCraft {
  readonly logline: string;
  readonly audiencePromise: string;
  readonly outline: string;
  readonly beats: ReadonlyArray<CraftBeat>;
  readonly reversals: ReadonlyArray<CraftReversal>;
  readonly payoffs: ReadonlyArray<CraftPayoff>;
  readonly pacingCurve: string;
  readonly hookStrategy: string;
  readonly climaxStrategy: string;
  readonly endingAftertaste: string;
  readonly originalizationRules: ReadonlyArray<string>;
  /** Deterministic prose-length recommendation derived from the video source. */
  readonly wordCountEstimate?: CraftWordCountEstimate;
}

/** A smaller breakdown card extracted from the reference work. */
export interface CraftBreakdownModule {
  /** Module category, used for grouping and ordering in the UI. */
  readonly category:
    | "opening"
    | "chapterFlow"
    | "sceneRhythm"
    | "disclosure"
    | "suspense"
    | "perspective"
    | "emotion"
    | "turningPoint"
    | "other";
  /** Short module label, such as "开篇钩子" or "信息释放". */
  readonly label: string;
  /** Concrete craft observation, grounded in the source text. */
  readonly summary: string;
  /** Verbatim evidence excerpt, if available. */
  readonly evidence?: string;
}

/** Structural techniques — how chapters are opened, arced, and closed. */
export interface CraftStructure {
  /** Typical opening pattern (悬念 / 场景 / 对话 / 倒叙). */
  readonly openingPattern: string;
  /** Single-chapter arc structure (起承转合 / 线性推进 / ...). */
  readonly chapterArc: string;
  /** Chapter-end hook type (悬念 / 反转 / 情绪留白). */
  readonly endingHookType: string;
  /** Representative excerpt demonstrating structural technique. */
  readonly exemplar?: string;
}

/** Scene and rhythm techniques — scene transitions, pacing, conflict escalation. */
export interface CraftSceneRhythm {
  /** Scene transition technique (硬切 / 过渡句 / 时间跳跃). */
  readonly sceneTransitionTechnique: string;
  /** Macro pacing curve — how tension alternates with relief. */
  readonly pacingCurve: string;
  /** Conflict escalation technique. */
  readonly conflictEscalation: string;
  readonly exemplar?: string;
}

/** Information disclosure techniques — foreshadowing, reveals, suspense. */
export interface CraftInformationDisclosure {
  /** Foreshadowing density (高 / 中 / 低). */
  readonly foreshadowingDensity: string;
  /** Information release rhythm (逐步释放 / 集中爆发). */
  readonly informationReleaseRhythm: string;
  /** Suspense management approach. */
  readonly suspenseManagement: string;
  readonly exemplar?: string;
}

/** Narrative perspective techniques — POV strategy, ratio, distance. */
export interface CraftNarrativePerspective {
  /** POV strategy and switching rules. */
  readonly povStrategy: string;
  /** Narration / dialogue / description ratio. */
  readonly narrationDialogueRatio: string;
  /** Narrative distance (贴近主角 / 拉开旁观). */
  readonly narrativeDistance: string;
  readonly exemplar?: string;
}

/** Complete writing craft profile for a reference work. */
export interface CraftProfile {
  readonly sourceName: string;
  readonly analyzedAt: string;
  readonly language: "zh" | "en";
  /** General writing craft or a horror-specific imitation profile. */
  readonly mode?: CraftMode;

  /** Reusable world rules and setting logic extracted from the reference. */
  readonly worldview?: string;
  /** Generalized story skeleton extracted from the reference. */
  readonly storyOutline?: string;
  /** User-approved story foundation cached for reuse during creation. */
  readonly storySeed?: StorySeed;

  readonly structure: CraftStructure;
  readonly sceneRhythm: CraftSceneRhythm;
  readonly informationDisclosure: CraftInformationDisclosure;
  readonly narrativePerspective: CraftNarrativePerspective;
  /** Present when mode is ghost-story. */
  readonly ghostStory?: GhostStoryCraft;
  /** Present when the source is a timestamped video transcript. */
  readonly videoStory?: VideoStoryCraft;

  /** Optional fine-grained breakdown modules for richer inspection. */
  readonly modules?: ReadonlyArray<CraftBreakdownModule>;
  /** Representative excerpts used as few-shot examples during generation. */
  readonly exemplars: ReadonlyArray<CraftExemplar>;
}

/** Metadata for a saved craft profile (stored alongside the full profile). */
export interface CraftMeta {
  readonly id: string;
  readonly sourceName: string;
  readonly createdAt: string;
  readonly language: "zh" | "en";
  readonly mode?: CraftMode;
  /** Where the reference content came from. Older metadata may omit this. */
  readonly sourceType?: "bilibili" | "novel";
  /** Stable source identity used to reparse instead of creating duplicates. */
  readonly sourceRef?: string;
  /** Short story summary shown in the craft list card. */
  readonly summary?: string;
  /** Recommended per-chapter length for story creation, when available. */
  readonly recommendedWordCount?: number;
  /** Cached story foundation generated for this writing craft. */
  readonly storySeed?: StorySeed;
  /** Genre id this craft is associated with (e.g. xianxia, horror). User-editable. */
  readonly genre?: string;
  /** ISO timestamp when the craft was moved to the trash. */
  readonly deletedAt?: string;
}

export function normalizeCraftSourceRef(
  sourceType: CraftMeta["sourceType"],
  sourceRef: string | undefined,
): string | undefined {
  const trimmed = sourceRef?.trim();
  if (!trimmed) return undefined;
  if (sourceType === "bilibili") {
    const bvid = trimmed.match(/(?:^|\/)(BV[0-9A-Za-z]+)(?:[/?#]|$)/u)?.[1]
      ?? trimmed.match(/^(BV[0-9A-Za-z]+)$/u)?.[1];
    return bvid;
  }
  return trimmed;
}

export function buildCraftMetaSummary(
  profile: Pick<CraftProfile, "storyOutline" | "worldview">,
): string {
  const raw = profile.storyOutline?.trim() || profile.worldview?.trim() || "";
  return raw.replace(/\s+/gu, " ").slice(0, 140);
}
import type { StorySeed } from "./story-seed.js";
