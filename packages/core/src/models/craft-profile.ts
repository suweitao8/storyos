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

  readonly structure: CraftStructure;
  readonly sceneRhythm: CraftSceneRhythm;
  readonly informationDisclosure: CraftInformationDisclosure;
  readonly narrativePerspective: CraftNarrativePerspective;

  /** Representative excerpts used as few-shot examples during generation. */
  readonly exemplars: ReadonlyArray<CraftExemplar>;
}

/** Metadata for a saved craft profile (stored alongside the full profile). */
export interface CraftMeta {
  readonly id: string;
  readonly sourceName: string;
  readonly createdAt: string;
  readonly language: "zh" | "en";
}
