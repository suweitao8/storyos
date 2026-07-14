import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson, putApi, useApi, postApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import type { SSEMessage } from "../hooks/use-sse";
import { useNewSSEMessages } from "../hooks/use-sse";
import { usePageToolbar } from "../components/PageToolbar";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { normalizeBilibiliCraftName, normalizeCraftDisplayName } from "./craft-name.js";
import {
  DEFAULT_CRAFT_TAB,
  type CraftTab,
  resolveAfterCraftDelete,
  resolveDefaultCraftSelection,
} from "./craft-navigation-state";
import { deriveCraftBreakdownModules } from "@actalk/inkos-core/agents/craft-breakdown";
import type { VideoStoryCraft } from "@actalk/inkos-core/models/craft-profile";
import type { StorySeed } from "@actalk/inkos-core";
import { StorySeedPreview } from "./StorySeedPreview";
import {
  serializeStorySeed,
  type StorySeedGenerationStatus,
} from "./story-seed-stream";
import {
  Wand2, BookOpen, Trash2, RotateCcw,
  Plus, FileUp, Loader2, FileText, RefreshCw, Download, Video, FileArchive,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CraftArtStyle = "realistic" | "cg3d";

const CRAFT_ART_STYLES: ReadonlyArray<{ readonly key: CraftArtStyle; readonly label: string }> = [
  { key: "realistic", label: "写实风格" },
  { key: "cg3d", label: "3D国漫风格" },
];

interface CraftMeta {
  readonly id: string;
  readonly sourceName: string;
  readonly createdAt: string;
  readonly language: "zh" | "en";
  readonly mode?: "general" | "ghost-story" | "bilibili-commentary" | "bilibili-short-story";
  readonly sourceType?: CraftSourceType;
  readonly summary?: string;
  readonly recommendedWordCount?: number;
  readonly storySeed?: StorySeed;
  readonly storySeedStatus?: "pending" | "ready" | "error";
  readonly storySeedError?: string;
  readonly artStyle?: CraftArtStyle;
  readonly processingStatus?: "processing" | "ready" | "error";
  readonly processingStage?: string;
  readonly processingError?: string;
  readonly deletedAt?: string;
}

export const CRAFT_LIST_GRID_CLASS = "grid gap-4 md:grid-cols-2 xl:grid-cols-4";

export function craftCardTitle(craft: Pick<CraftMeta, "sourceName" | "mode" | "sourceType">): string {
  return craft.sourceType === "bilibili"
    ? normalizeBilibiliCraftName(craft.sourceName)
    : normalizeCraftDisplayName(craft.sourceName);
}

export function craftSourceTypeLabel(sourceType: CraftSourceType | undefined): string {
  if (sourceType === "bilibili") return "视频解析";
  if (sourceType === "novel") return "小说解析";
  return "来源未记录";
}

export function craftCardMeta(
  craft: Pick<CraftMeta, "sourceType" | "recommendedWordCount">,
): string {
  const sourceType = craftSourceTypeLabel(craft.sourceType);
  return craft.recommendedWordCount && craft.recommendedWordCount > 0
    ? `${sourceType} · 建议约 ${craft.recommendedWordCount.toLocaleString()} 字`
    : sourceType;
}

export function craftCardDescription(craft: Pick<CraftMeta, "mode" | "summary">): string {
  const summary = craft.summary?.trim();
  if (summary) return summary;
  return "提取开篇结构、场景节奏、信息释放与叙事视角";
}

const CRAFT_TIME_TOKEN = /(?:\d{1,2}:){1,2}\d{1,2}(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:秒|s|sec(?:onds?)?)/gi;

function parseCraftTimestamp(value: string): number | undefined {
  const normalized = value.trim().replace(/,/g, ".").replace(/[^\d.:]/gi, "");
  if (!normalized) return undefined;
  const parts = normalized.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return undefined;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}

function formatCraftTimeShort(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return remainder === 0 ? `${minutes}分` : `${minutes}分${remainder}秒`;
}

/**
 * Simplify a timeRange string into a clean "start–end" label.
 * Rounds to whole seconds, drops fractional precision.
 * Example: "00:12.5-01:35.2" → "12秒–1分35秒"
 */
export function formatCraftBeatDuration(timeRange: string | undefined): string | undefined {
  if (!timeRange?.trim()) return undefined;

  const timestamps = (timeRange.match(CRAFT_TIME_TOKEN) ?? [])
    .map(parseCraftTimestamp)
    .filter((value): value is number => value !== undefined);

  if (timestamps.length >= 2) {
    return `${formatCraftTimeShort(timestamps[0])}–${formatCraftTimeShort(timestamps[1])}`;
  }

  return undefined;
}

interface CraftListResponse {
  readonly crafts: ReadonlyArray<CraftMeta>;
  readonly recentCraftId: string | null;
  readonly recentCraftPreferenceAvailable: boolean;
}

interface BilibiliImportResponse {
  readonly sourceAssetId: string;
  readonly text: string;
  readonly detectedName: string;
  readonly videoInfo: {
    readonly bvid: string;
    readonly title: string;
    readonly duration: number;
    readonly upName?: string;
  };
  readonly subtitleSource: "bili" | "bcut";
  readonly subtitleCount: number;
  readonly correctionStatus: "corrected" | "fallback";
  readonly correctionChangedCount: number;
  readonly correctionMessage?: string;
  readonly subtitlePreview: ReadonlyArray<{
    readonly from: number;
    readonly to: number;
    readonly content: string;
  }>;
}

interface BilibiliCreateResponse {
  readonly status: "processing" | "ready" | "error";
  readonly craftId: string;
  readonly meta: CraftMeta;
}

export function craftProcessingLabel(craft: Pick<CraftMeta, "processingStatus" | "processingStage">): string | null {
  if (craft.processingStatus === "processing") return craft.processingStage?.trim() || "后台处理中";
  if (craft.processingStatus === "error") return "处理失败，可重试";
  return null;
}

export type CraftSourceType = "bilibili" | "novel";

type CraftSourceFileKey = "source" | "video" | "subtitlesJson" | "subtitlesText" | "analysisInput";

interface CraftSourceFile {
  readonly key: CraftSourceFileKey;
  readonly fileName: string;
  readonly downloadName: string;
  readonly size: number;
  readonly mimeType: string;
}

interface CraftSourceManifest {
  readonly version: 1;
  readonly sourceType: CraftSourceType;
  readonly sourceName: string;
  readonly originalName: string;
  readonly sourceRef?: string;
  readonly sourceDurationSeconds?: number;
  readonly subtitleSource?: "bili" | "bcut";
  readonly importedAt: string;
  readonly files: ReadonlyArray<CraftSourceFile>;
}

interface CraftSourceResponse {
  readonly source: CraftSourceManifest | null;
}

export const CRAFT_DETAIL_TABS = [
  { value: "overview", label: "概览" },
  { value: "story", label: "故事设定" },
  { value: "video", label: "视频拆解" },
  { value: "modules", label: "写作要点" },
  { value: "exemplars", label: "示例" },
  { value: "source", label: "原始资料" },
] as const;

type CraftDetailTab = typeof CRAFT_DETAIL_TABS[number]["value"];

export const CRAFT_SOURCE_TYPES: ReadonlyArray<{ value: CraftSourceType; label: string }> = [
  { value: "bilibili", label: "B 站视频链接" },
  { value: "novel", label: "小说文本文件" },
];

export function buildCraftAnalyzePayload(
  source: { type: CraftSourceType; text: string; detectedName: string; sourceRef?: string; sourceDurationSeconds?: number },
  mode: "general" | "ghost-story" = "general",
) {
  return {
    text: source.text,
    sourceName: source.type === "bilibili"
      ? normalizeBilibiliCraftName(source.detectedName)
      : normalizeCraftDisplayName(source.detectedName),
    sourceType: source.type,
    language: "zh" as const,
    mode,
    ...(source.sourceRef?.trim() ? { sourceRef: source.sourceRef.trim() } : {}),
    ...(source.sourceDurationSeconds && source.sourceDurationSeconds > 0
      ? { sourceDurationSeconds: source.sourceDurationSeconds }
      : {}),
  };
}

interface CraftExemplar {
  readonly label: string;
  readonly tone: string;
  readonly excerpt: string;
}

interface CraftModule {
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
  readonly label: string;
  readonly summary: string;
  readonly evidence?: string;
}

const CRAFT_CATEGORY_LABELS: Record<"zh" | "en", Record<CraftModule["category"], string>> = {
  zh: {
    opening: "开篇",
    chapterFlow: "章节推进",
    sceneRhythm: "场景与节奏",
    disclosure: "信息释放",
    suspense: "悬念管理",
    perspective: "叙事视角",
    emotion: "情绪推进",
    turningPoint: "转折与回收",
    other: "其他",
  },
  en: {
    opening: "Opening",
    chapterFlow: "Chapter Flow",
    sceneRhythm: "Scene & Rhythm",
    disclosure: "Information Release",
    suspense: "Suspense",
    perspective: "Perspective",
    emotion: "Emotion",
    turningPoint: "Turning Point",
    other: "Other",
  },
};

export function craftModuleCategoryLabel(
  category: CraftModule["category"],
  language: "zh" | "en",
): string {
  return CRAFT_CATEGORY_LABELS[language][category];
}

interface CraftProfile {
  readonly sourceName: string;
  readonly analyzedAt: string;
  readonly language: "zh" | "en";
  readonly mode?: "general" | "ghost-story";
  readonly sourceType?: CraftSourceType;
  readonly worldview?: string;
  readonly storyOutline?: string;
  readonly storySeed?: StorySeed;
  readonly structure: {
    readonly openingPattern: string;
    readonly chapterArc: string;
    readonly endingHookType: string;
    readonly exemplar?: string;
  };
  readonly sceneRhythm: {
    readonly sceneTransitionTechnique: string;
    readonly pacingCurve: string;
    readonly conflictEscalation: string;
    readonly exemplar?: string;
  };
  readonly informationDisclosure: {
    readonly foreshadowingDensity: string;
    readonly informationReleaseRhythm: string;
    readonly suspenseManagement: string;
    readonly exemplar?: string;
  };
  readonly narrativePerspective: {
    readonly povStrategy: string;
    readonly narrationDialogueRatio: string;
    readonly narrativeDistance: string;
    readonly exemplar?: string;
  };
  readonly ghostStory?: {
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
  };
  readonly videoStory?: VideoStoryCraft;
  readonly modules?: ReadonlyArray<CraftModule>;
  readonly exemplars: ReadonlyArray<CraftExemplar>;
}

interface Nav { toDashboard: () => void }

export const CRAFT_TABS = ["list", "create", "detail"] as const satisfies ReadonlyArray<CraftTab>;

export const CRAFT_LAYOUT_CLASSES = {
  content: "w-full space-y-6",
  tabBar: "flex w-full border-b border-border",
  tab: "flex flex-1 items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
} as const;

export function advanceCraftNavigationToken(currentToken: number): number {
  return currentToken + 1;
}

interface SseState {
  readonly messages: ReadonlyArray<SSEMessage>;
}

interface CraftLegacySection {
  readonly title: string;
  readonly fields: ReadonlyArray<[string, string]>;
  readonly exemplar?: string;
}

interface CraftDetailModel {
  readonly moduleCount: number;
  readonly exemplarCount: number;
  readonly modules: ReadonlyArray<CraftModule>;
  readonly legacySections: ReadonlyArray<CraftLegacySection>;
  readonly worldview?: string;
  readonly storyOutline?: string;
  readonly videoStory?: VideoStoryCraft;
}

export function buildCraftDetailModel(profile: CraftProfile): CraftDetailModel {
  const modules = deriveCraftBreakdownModules(profile) as ReadonlyArray<CraftModule>;

  return {
    moduleCount: modules.length,
    exemplarCount: profile.exemplars.length,
    modules,
    worldview: profile.worldview,
    storyOutline: profile.storyOutline,
    videoStory: profile.videoStory,
    legacySections: [
      {
        title: "结构手法",
        fields: [
          ["开篇模式", profile.structure.openingPattern],
          ["单章弧线", profile.structure.chapterArc],
          ["章末钩子", profile.structure.endingHookType],
        ],
        exemplar: profile.structure.exemplar,
      },
      {
        title: "场景与节奏",
        fields: [
          ["场景切换", profile.sceneRhythm.sceneTransitionTechnique],
          ["节奏曲线", profile.sceneRhythm.pacingCurve],
          ["冲突升级", profile.sceneRhythm.conflictEscalation],
        ],
        exemplar: profile.sceneRhythm.exemplar,
      },
      {
        title: "信息披露",
        fields: [
          ["伏笔密度", profile.informationDisclosure.foreshadowingDensity],
          ["信息释放", profile.informationDisclosure.informationReleaseRhythm],
          ["悬念管理", profile.informationDisclosure.suspenseManagement],
        ],
        exemplar: profile.informationDisclosure.exemplar,
      },
      {
        title: "叙事视角",
        fields: [
          ["POV 策略", profile.narrativePerspective.povStrategy],
          ["叙述/对话比例", profile.narrativePerspective.narrationDialogueRatio],
          ["叙事距离", profile.narrativePerspective.narrativeDistance],
        ],
        exemplar: profile.narrativePerspective.exemplar,
      },
    ],
  };
}

export function craftListRowClassName(isSelected: boolean, cardStatic: string): string {
  return `relative min-h-40 border ${isSelected ? "border-primary/50 bg-primary/5" : cardStatic} rounded-2xl p-5 flex flex-col gap-4 hover:bg-secondary/20 transition-colors cursor-pointer`;
}

export function resolveCraftDeleteSelection(
  selectedCraftId: string | null,
  deletedCraftId: string,
  remainingCraftIds: ReadonlyArray<string>,
): {
  readonly selectedCraftId: string | null;
  readonly shouldPersistRecentCraft: boolean;
} {
  const selectedCraftStillExists =
    selectedCraftId !== null && remainingCraftIds.includes(selectedCraftId);

  if (
    deletedCraftId !== selectedCraftId &&
    (selectedCraftId === null || selectedCraftStillExists)
  ) {
    return {
      selectedCraftId,
      shouldPersistRecentCraft: false,
    };
  }

  const fallback = resolveAfterCraftDelete(deletedCraftId, remainingCraftIds);
  return {
    selectedCraftId: fallback.selectedCraftId,
    shouldPersistRecentCraft: true,
  };
}

export function shouldApplyCraftDeleteFallback(
  selectedCraftId: string | null,
  deletedCraftId: string,
  operationId: number,
  latestOperationId: number,
): boolean {
  return selectedCraftId === deletedCraftId && operationId === latestOperationId;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CraftManager({ nav, theme, t, sse }: { nav: Nav; theme: Theme; t: TFunction; sse: SseState }) {
  const c = useColors(theme);
  const [tab, setTab] = useState<CraftTab>(DEFAULT_CRAFT_TAB);
  const [selectedCraftId, setSelectedCraftId] = useState<string | null>(null);
  const [newProfile, setNewProfile] = useState<CraftProfile | null>(null);
  const [newMeta, setNewMeta] = useState<CraftMeta | null>(null);
  const userNavigatedRef = useRef(false);
  const selectedCraftIdRef = useRef<string | null>(null);
  const selectionOperationRef = useRef(0);
  const recentCraftWriteChainRef = useRef(Promise.resolve());
  const {
    data: craftsData,
    loading: craftsLoading,
    error: craftsError,
    refetch,
    mutate,
  } = useApi<CraftListResponse>("/crafts");

  const crafts = craftsData?.crafts ?? [];

  useEffect(() => {
    if (userNavigatedRef.current || selectedCraftIdRef.current) return;

    const defaultCraftId = resolveDefaultCraftSelection(
      crafts.filter((craft) => !craft.deletedAt).map((craft) => craft.id),
      craftsData?.recentCraftId ?? null,
    );
    if (!defaultCraftId) return;

    selectedCraftIdRef.current = defaultCraftId;
    setSelectedCraftId(defaultCraftId);
  }, [crafts, craftsData?.recentCraftId]);

  const markUserNavigation = () => {
    userNavigatedRef.current = true;
    selectionOperationRef.current = advanceCraftNavigationToken(selectionOperationRef.current);
  };

  const persistRecentCraft = (craftId: string | null) => {
    const nextWrite = recentCraftWriteChainRef.current
      .catch(() => undefined)
      .then(async () => {
        if (craftId) {
          await putApi("/crafts/recent", { craftId });
        } else {
          await fetchJson("/crafts/recent", { method: "DELETE" });
        }
      })
      .catch(() => undefined);
    recentCraftWriteChainRef.current = nextWrite;
    return nextWrite;
  };

  const openDetail = (craftId: string) => {
    markUserNavigation();
    selectedCraftIdRef.current = craftId;
    setSelectedCraftId(craftId);
    setNewProfile(null);
    setNewMeta(null);
    setTab("detail");
    void persistRecentCraft(craftId);
  };

  const handleCreated = async (profile: CraftProfile | null, craftId: string, meta?: CraftMeta) => {
    markUserNavigation();
    setNewProfile(profile);
    setNewMeta(meta ?? null);
    selectedCraftIdRef.current = craftId;
    setSelectedCraftId(craftId);
    setTab("detail");
    await persistRecentCraft(craftId);
    await refetch();
  };

  const handleDelete = async (deletedCraftId: string) => {
    markUserNavigation();
    const operationId = selectionOperationRef.current;
    try {
      await fetchJson(`/crafts/${deletedCraftId}`, { method: "DELETE" });
      const latest = await fetchJson<CraftListResponse>("/crafts");
      mutate(latest);

      if (!shouldApplyCraftDeleteFallback(
        selectedCraftIdRef.current,
        deletedCraftId,
        operationId,
        selectionOperationRef.current,
      )) return;

      const deletion = resolveCraftDeleteSelection(
        selectedCraftIdRef.current,
        deletedCraftId,
        latest.crafts.filter((craft) => !craft.deletedAt).map((craft) => craft.id),
      );
      if (!deletion.shouldPersistRecentCraft) return;

      setTab(deletion.selectedCraftId ? "detail" : "list");
      selectedCraftIdRef.current = deletion.selectedCraftId;
      setSelectedCraftId(deletion.selectedCraftId);
      setNewProfile(null);
      setNewMeta(null);
      await persistRecentCraft(deletion.selectedCraftId);
    } catch {
      // Keep the current view intact when deletion or refresh fails.
    }
  };

  const handleRestore = async (restoredCraftId: string) => {
    try {
      await fetchJson(`/crafts/${encodeURIComponent(restoredCraftId)}/restore`, { method: "POST" });
      mutate(await fetchJson<CraftListResponse>("/crafts"));
    } catch {
      // Keep the current list intact when restore fails.
    }
  };

  const openList = () => {
    markUserNavigation();
    setTab("list");
    setNewProfile(null);
    void refetch();
  };

  const openCreate = () => {
    markUserNavigation();
    setTab("create");
    setNewProfile(null);
  };

  const openDetailTab = () => {
    markUserNavigation();
    setTab("detail");
  };

  const tabConfig: Record<CraftTab, { icon: React.ReactNode; label: string; onClick: () => void }> = {
    list: { icon: <BookOpen size={15} />, label: t("craft.tabList"), onClick: openList },
    create: { icon: <Plus size={15} />, label: t("craft.tabCreate"), onClick: openCreate },
    detail: { icon: <FileText size={15} />, label: t("craft.tabDetail"), onClick: openDetailTab },
  };

  usePageToolbar("craft", {
    tabs: CRAFT_TABS.map((craftTab) => ({
      id: craftTab,
      label: tabConfig[craftTab].label,
      icon: tabConfig[craftTab].icon,
    })),
    activeTab: tab,
    onTabChange: (craftTab) => tabConfig[craftTab as CraftTab]?.onClick(),
  });

  return (
    <div className={CRAFT_LAYOUT_CLASSES.content}>
      {/* Tab content */}
      {tab === "list" && (
        craftsLoading && crafts.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : craftsError ? (
          <div className="space-y-3 py-12 text-center" role="alert">
            <p className="text-sm text-destructive">加载模式列表失败：{craftsError}</p>
            <button
              onClick={() => void refetch()}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              重试
            </button>
          </div>
        ) : (
          <CraftList
            crafts={crafts}
            selectedCraftId={selectedCraftId}
            c={c}
            t={t}
            onOpen={openDetail}
            onDelete={handleDelete}
            onRestore={handleRestore}
          />
        )
      )}

      {tab === "create" && (
        <CraftCreate
          c={c}
          t={t}
          sse={sse}
          onSuccess={handleCreated}
        />
      )}

      {tab === "detail" && (
        <CraftDetail
          craftId={selectedCraftId}
          initialProfile={newProfile}
          initialMeta={newMeta ?? crafts.find((cr) => cr.id === selectedCraftId)}
          initialArtStyle={crafts.find((cr) => cr.id === selectedCraftId)?.artStyle}
          c={c}
          t={t}
          onNew={openCreate}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Craft list
// ---------------------------------------------------------------------------

function CraftList({ crafts, selectedCraftId, c, t, onOpen, onDelete, onRestore }: {
  crafts: ReadonlyArray<CraftMeta>;
  selectedCraftId: string | null;
  c: ReturnType<typeof useColors>;
  t: TFunction;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
}) {
  const [deleteTarget, setDeleteTarget] = useState<CraftMeta | null>(null);
  if (crafts.length === 0) {
    return (
      <div className="min-h-40 rounded-2xl border border-dashed border-border/40 p-5 text-center">
        <Wand2 size={28} className="mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("craft.noProfiles")}</p>
      </div>
    );
  }

  return (
    <div className={CRAFT_LIST_GRID_CLASS}>
      {crafts.map((craft) => (
        <div
          key={craft.id}
          className={`${craftListRowClassName(craft.id === selectedCraftId, c.cardStatic)} ${craft.deletedAt ? "opacity-60 grayscale cursor-not-allowed" : ""}`}
        >
          <button disabled={Boolean(craft.deletedAt)} onClick={() => onOpen(craft.id)} className={`flex min-w-0 flex-1 flex-col items-start gap-3 pr-6 text-left ${craft.deletedAt ? "cursor-not-allowed" : ""}`}>
            <span className="font-medium text-sm">{craftCardTitle(craft)}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${craft.deletedAt ? "border-border/60 bg-secondary/50 text-muted-foreground" : "border-border/60 bg-secondary/20 text-muted-foreground"}`}>
              {craft.deletedAt ? "垃圾桶 · 72 小时后自动清理" : craftCardMeta(craft)}
            </span>
            {craftProcessingLabel(craft) && (
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${craft.processingStatus === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                {craftProcessingLabel(craft)}
              </span>
            )}
            <span className="text-xs leading-5 text-muted-foreground">{craftCardDescription(craft)}</span>
          </button>
          {craft.deletedAt ? (
            <button
              aria-label="恢复写作模式"
              onClick={(e) => { e.stopPropagation(); void onRestore(craft.id); }}
              className="absolute right-4 top-4 text-muted-foreground hover:text-primary transition-colors"
            >
              <RotateCcw size={14} />
            </button>
          ) : (
            <button
              aria-label="删除写作模式"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(craft); }}
              className="absolute right-4 top-4 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="移入垃圾桶"
        message={`确认将“${deleteTarget?.sourceName ?? ""}”移入垃圾桶吗？72 小时后会自动删除。`}
        confirmLabel="移入垃圾桶"
        cancelLabel="取消"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) void onDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Create (upload + extract)
// ---------------------------------------------------------------------------

interface UploadResponse {
  readonly sourceAssetId: string;
  readonly text: string;
  readonly encoding: string;
  readonly chapterCount: number;
  readonly usedChapters: number;
  readonly detectedName: string;
}

function CraftCreate({ c, t, sse, onSuccess }: {
  c: ReturnType<typeof useColors>;
  t: TFunction;
  sse: SseState;
  onSuccess: (profile: CraftProfile | null, craftId: string, meta?: CraftMeta) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSourceNameRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [bilibiliUrl, setBilibiliUrl] = useState("");
  const [bilibiliResult, setBilibiliResult] = useState<BilibiliImportResponse | null>(null);
  const [importingBilibili, setImportingBilibili] = useState(false);
  const [bilibiliError, setBilibiliError] = useState("");
  const [sourceType, setSourceType] = useState<CraftSourceType>("novel");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [currentStep, setCurrentStep] = useState("");
  const [progressLogs, setProgressLogs] = useState<ReadonlyArray<string>>([]);

  const appendProgressLog = useCallback((message: string) => {
    setProgressLogs((prev) => [...prev, message].slice(-12));
  }, []);

  const handleProgressEvent = useCallback((event: SSEMessage) => {
    const activeSourceName = activeSourceNameRef.current;
    if (!activeSourceName) return;
    const data = event.data as { sourceName?: string; message?: string; error?: string; tag?: string } | null;

    if (event.event === "log") {
      const rawMessage = data?.message;
      if (!rawMessage?.startsWith("[craft] ")) return;
      const progressMessage = rawMessage.replace(/^\[craft\]\s*/, "").trim();
      if (!progressMessage) return;
      setCurrentStep(progressMessage);
      appendProgressLog(progressMessage);
      return;
    }

    if (data?.sourceName !== activeSourceName) return;

    if (event.event === "craft:start") {
      const message = t("craft.progressStarted");
      setCurrentStep(message);
      appendProgressLog(message);
      return;
    }

    if (event.event === "craft:complete") {
      const message = t("craft.progressFinished");
      setCurrentStep(message);
      appendProgressLog(message);
      return;
    }

    if (event.event === "craft:error") {
      const message = data?.error ?? t("craft.progressWaiting");
      setExtractError(message);
      setCurrentStep(message);
      appendProgressLog(message);
    }
  }, [appendProgressLog, t]);

  useNewSSEMessages(sse.messages, handleProgressEvent);

  const runExtraction = useCallback(async (source: {
    type: CraftSourceType;
    text: string;
    detectedName: string;
    sourceRef?: string;
    sourceDurationSeconds?: number;
    sourceAssetId?: string;
  }) => {
    const sourceName = source.type === "bilibili"
      ? normalizeBilibiliCraftName(source.detectedName)
      : normalizeCraftDisplayName(source.detectedName);
    activeSourceNameRef.current = sourceName;
    setExtracting(true);
    setExtractError("");
    setCurrentStep(t("craft.progressWaiting"));
    setProgressLogs((prev) => [...prev, t("craft.progressWaiting")].slice(-12));
    try {
      const result = await postApi<{ craftId: string; profile: CraftProfile; meta?: CraftMeta }>("/craft/analyze", {
        ...buildCraftAnalyzePayload(source),
        ...(source.sourceAssetId ? { sourceAssetId: source.sourceAssetId } : {}),
      });
      onSuccess(result.profile, result.craftId, result.meta);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : String(e));
    } finally {
      setExtracting(false);
    }
  }, [onSuccess, t]);

  const handleSourceTypeChange = (nextSourceType: CraftSourceType) => {
    if (busy) return;
    setSourceType(nextSourceType);
    setUploadError("");
    setUploadResult(null);
    setBilibiliError("");
    setBilibiliResult(null);
    setExtractError("");
    setCurrentStep("");
    setProgressLogs([]);
    activeSourceNameRef.current = null;
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setUploadError("");
    setUploadResult(null);
    setBilibiliResult(null);
    setBilibiliError("");
    setExtractError("");
    setCurrentStep("");
    setProgressLogs([]);
    activeSourceNameRef.current = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const response = await fetch("/api/v1/craft/upload", {
        method: "POST",
        body: arrayBuffer,
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Filename": encodeURIComponent(file.name),
        },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: String(response.status) }));
        throw new Error(err.error ?? "upload failed");
      }
      const data: UploadResponse = await response.json();
      setUploadResult(data);
      await runExtraction({
        type: "novel",
        text: data.text,
        detectedName: data.detectedName,
        sourceAssetId: data.sourceAssetId,
      });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleBilibiliImport = async () => {
    if (!bilibiliUrl.trim()) return;
    setImportingBilibili(true);
    setBilibiliError("");
    setBilibiliResult(null);
    setUploadResult(null);
    setUploadError("");
    setExtractError("");
    setCurrentStep("正在创建模式，后台将获取视频与字幕");
    setProgressLogs(["正在创建模式，后台将获取视频与字幕"]);
    try {
      const data = await postApi<BilibiliCreateResponse>("/craft/bilibili/create", { url: bilibiliUrl.trim() });
      setCurrentStep(data.meta.processingStage ?? "后台处理中");
      setProgressLogs((prev) => [...prev, data.meta.processingStage ?? "后台处理中"]);
      onSuccess(null, data.craftId, data.meta);
    } catch (e) {
      setBilibiliError(e instanceof Error ? e.message : String(e));
      setCurrentStep("B 站模式创建失败");
      setProgressLogs((prev) => [...prev, "B 站模式创建失败"]);
    } finally {
      setImportingBilibili(false);
    }
  };

  const busy = uploading || importingBilibili || extracting;

  return (
    <div className="w-full space-y-6">
      <div className="grid gap-3 md:grid-cols-2" role="group" aria-label="模式来源">
        {CRAFT_SOURCE_TYPES.map((source) => {
          const selected = sourceType === source.value;
          return (
            <button
              key={source.value}
              type="button"
              aria-pressed={selected}
              onClick={() => handleSourceTypeChange(source.value)}
              disabled={busy}
              className={`rounded-2xl border p-4 text-left transition-colors ${selected
                ? "border-primary/60 bg-primary/5"
                : "border-border/60 bg-secondary/10 hover:border-primary/30 hover:bg-secondary/20"} disabled:opacity-50`}
            >
              <div className="text-sm font-semibold">{source.label}</div>
            </button>
          );
        })}
      </div>

      {sourceType === "bilibili" && (
      <div className="rounded-2xl border border-border/60 bg-secondary/10 p-4 space-y-3">
        <div className="text-sm font-medium">B 站视频字幕</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={bilibiliUrl}
            onChange={(event) => setBilibiliUrl(event.target.value)}
            disabled={busy}
            placeholder="粘贴 B 站视频链接或 BV 号"
            className="min-w-0 flex-1 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => void handleBilibiliImport()}
            disabled={!bilibiliUrl.trim() || busy}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm ${c.btnPrimary} disabled:opacity-30`}
          >
            {importingBilibili ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {importingBilibili ? "创建中" : "创建写作模式"}
          </button>
        </div>
        {bilibiliError && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {bilibiliError}
          </div>
        )}
        {bilibiliResult && (
          <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.03] p-3 text-sm">
            <div className="font-medium">{bilibiliResult.videoInfo.title}</div>
            <div className="text-xs text-muted-foreground">
              {bilibiliResult.videoInfo.upName || "未知 UP 主"} · {Math.round(bilibiliResult.videoInfo.duration / 60)} 分钟 ·
              {bilibiliResult.subtitleSource === "bili" ? " B 站 CC 字幕" : " Bcut 音频识别"} · 共 {bilibiliResult.subtitleCount} 条
            </div>
            <div className={bilibiliResult.correctionStatus === "corrected" ? "text-xs text-emerald-600" : "text-xs text-amber-600"}>
              {bilibiliResult.correctionStatus === "corrected"
                ? `已完成字幕文字校正，修正 ${bilibiliResult.correctionChangedCount} 处`
                : (bilibiliResult.correctionMessage ?? "字幕文字校正失败，已使用原始字幕")}
            </div>
            <div className="max-h-40 overflow-auto rounded-lg border border-border/60 bg-secondary/20 p-2 text-xs leading-5 text-muted-foreground">
              {bilibiliResult.subtitlePreview.map((entry) => (
                <div key={`${entry.from}-${entry.to}-${entry.content}`}>[{entry.from.toFixed(1)}s] {entry.content}</div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {sourceType === "novel" && (
        <>
      {/* File upload zone */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        className={`w-full border-2 border-dashed rounded-xl p-10 text-center transition-colors disabled:opacity-40 ${
          uploadResult
            ? "border-emerald-500/30 bg-emerald-500/[0.03]"
            : "border-border/40 hover:border-primary/30 hover:bg-secondary/20"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm">{t("craft.uploading")}</span>
          </div>
        ) : uploadResult ? (
          <div className="flex flex-col items-center gap-1 text-sm">
            <FileText size={28} className="text-emerald-500 mb-1" />
            <span className="font-medium">{normalizeCraftDisplayName(uploadResult.detectedName)}</span>
            {uploadResult ? (
              <>
                <span className="text-xs text-muted-foreground">
                  {t("craft.detectedEncoding")}: {uploadResult.encoding}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("craft.chapterInfo")
                    .replace("{total}", String(uploadResult.chapterCount))
                    .replace("{used}", String(uploadResult.usedChapters))}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">B 站字幕已准备</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <FileUp size={28} />
            <span className="text-sm font-medium">{t("craft.dropFile")}</span>
            <span className="text-xs">{t("craft.dropFileHint")}</span>
          </div>
        )}
      </button>

      {uploadError && !bilibiliResult && (
        <div className="px-4 py-2 rounded-lg text-sm bg-destructive/10 text-destructive">
          {uploadError}
        </div>
      )}
        </>
      )}

      {extractError && (
        <div className="px-4 py-2 rounded-lg text-sm bg-destructive/10 text-destructive">
          {extractError}
        </div>
      )}

      {(extracting || progressLogs.length > 0) && (
        <div className={`rounded-2xl border ${c.cardStatic} p-4 space-y-4`}>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("craft.progressTitle")}
            </div>
            <div className="text-sm font-medium">
              {t("craft.progressCurrentStep")}：{currentStep || t("craft.progressWaiting")}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("craft.progressLogs")}
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/20 px-3 py-3">
              {progressLogs.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {t("craft.progressPending")}
                </div>
              ) : (
                <div className="space-y-2">
                  {progressLogs.map((log, index) => (
                    <div key={`${index}-${log}`} className="text-sm leading-6 text-foreground/90">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Detail
// ---------------------------------------------------------------------------

interface CraftStatusResponse {
  readonly craftId: string;
  readonly status: "processing" | "ready" | "error";
  readonly meta: CraftMeta;
  readonly error?: string | null;
}

function CraftDetail({ craftId, initialProfile, initialMeta, initialArtStyle, c, t, onNew }: {
  craftId: string | null;
  initialProfile: CraftProfile | null;
  initialMeta?: CraftMeta;
  initialArtStyle?: CraftArtStyle;
  c: ReturnType<typeof useColors>;
  t: TFunction;
  onNew: () => void;
}) {
  const [profile, setProfile] = useState<CraftProfile | null>(initialProfile);
  const [meta, setMeta] = useState<CraftMeta | undefined>(initialMeta);
  const [loading, setLoading] = useState(!!craftId && !initialProfile && initialMeta?.processingStatus !== "processing" && initialMeta?.processingStatus !== "error");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<CraftSourceManifest | null>(null);
  const [sourceLoading, setSourceLoading] = useState(!!craftId);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [reparsing, setReparsing] = useState(false);
  const [detailTab, setDetailTab] = useState<CraftDetailTab>("overview");
  const [storySeed, setStorySeed] = useState<StorySeed | null>(initialProfile?.storySeed ?? null);
  const [storySeedStreamedContent, setStorySeedStreamedContent] = useState(
    initialProfile?.storySeed ? serializeStorySeed(initialProfile.storySeed, initialProfile.language) : "",
  );
  const [storySeedStatus, setStorySeedStatus] = useState<StorySeedGenerationStatus>(
    initialProfile?.storySeed ? "ready" : "idle",
  );
  const [storySeedError, setStorySeedError] = useState<string | null>(initialMeta?.storySeedError ?? null);
  const [storySeedGenerating, setStorySeedGenerating] = useState(false);
  const [subtitleText, setSubtitleText] = useState<string | null>(null);
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  const [artStyle, setArtStyle] = useState<CraftArtStyle>(initialArtStyle ?? "realistic");
  const [artStyleSaving, setArtStyleSaving] = useState(false);

  useEffect(() => {
    setArtStyle(initialArtStyle ?? "realistic");
  }, [craftId, initialArtStyle]);

  const handleArtStyleChange = useCallback(async (nextArtStyle: CraftArtStyle) => {
    if (!craftId) return;
    setArtStyle(nextArtStyle);
    setArtStyleSaving(true);
    try {
      await putApi(`/crafts/${craftId}/meta`, { artStyle: nextArtStyle });
    } catch {
      // silent — user can retry by selecting again
    } finally {
      setArtStyleSaving(false);
    }
  }, [craftId]);

  const loadProfile = useCallback(async () => {
    if (!craftId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<CraftProfile>(`/crafts/${craftId}`, { method: "GET" });
      setProfile(data);
      if (data.storySeed) {
        setStorySeed(data.storySeed);
        setStorySeedStreamedContent(serializeStorySeed(data.storySeed, data.language));
        setStorySeedStatus("ready");
        setStorySeedError(null);
      }
    } catch (loadError) {
      setProfile(null);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [craftId]);

  useEffect(() => {
    setProfile(initialProfile);
    setMeta(initialMeta);
    setStorySeed(initialProfile?.storySeed ?? null);
    setStorySeedStreamedContent(initialProfile?.storySeed ? serializeStorySeed(initialProfile.storySeed, initialProfile.language) : "");
    setStorySeedStatus(initialProfile?.storySeed ? "ready" : initialMeta?.storySeedStatus === "pending" ? "generating" : initialMeta?.storySeedStatus === "error" ? "error" : "idle");
    setStorySeedError(initialMeta?.storySeedError ?? null);
    setError(null);
    if (!craftId || initialProfile || initialMeta?.processingStatus === "processing" || initialMeta?.processingStatus === "error") {
      setLoading(false);
      return;
    }
    void loadProfile();
  }, [craftId, initialMeta, initialProfile, loadProfile]);

  const loadStatus = useCallback(async () => {
    if (!craftId) return;
    try {
      const data = await fetchJson<CraftStatusResponse>(`/crafts/${craftId}/status`, { method: "GET" });
      setMeta(data.meta);
      if (data.meta.storySeedStatus === "pending") {
        setStorySeedStatus("generating");
        setStorySeedError(null);
      } else if (data.meta.storySeedStatus === "error") {
        setStorySeedStatus("error");
        setStorySeedError(data.meta.storySeedError ?? "默认故事设定生成失败");
      }
      if (data.status === "ready" && data.meta.storySeedStatus !== "pending") {
        await loadProfile();
      } else if (data.status === "error") {
        setError(data.error ?? data.meta.processingError ?? "后台处理失败");
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : String(statusError));
    }
  }, [craftId, loadProfile]);

  useEffect(() => {
    if (!craftId || profile?.storySeed || meta?.storySeedStatus || meta?.processingStatus === "processing" || meta?.processingStatus === "error") return;
    void loadStatus();
  }, [craftId, loadStatus, meta?.processingStatus, meta?.storySeedStatus, profile?.storySeed]);

  useEffect(() => {
    if (!craftId || meta?.storySeedStatus !== "pending" || meta.processingStatus === "processing") return;
    let active = true;
    const poll = async () => {
      if (active) await loadStatus();
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [craftId, loadStatus, meta?.processingStatus, meta?.storySeedStatus]);

  useEffect(() => {
    if (!craftId || meta?.processingStatus !== "processing") return;
    let active = true;
    const poll = async () => {
      if (!active) return;
      await loadStatus();
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [craftId, loadStatus, meta?.processingStatus]);

  const loadSource = useCallback(async () => {
    if (!craftId) return;
    setSourceLoading(true);
    setSourceError(null);
    try {
      const data = await fetchJson<CraftSourceResponse>(`/crafts/${craftId}/source`, { method: "GET" });
      setSource(data.source);
    } catch (loadError) {
      setSource(null);
      setSourceError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setSourceLoading(false);
    }
  }, [craftId]);

  useEffect(() => {
    setDetailTab("overview");
    setSource(null);
    if (craftId && profile && meta?.processingStatus !== "processing" && meta?.processingStatus !== "error") void loadSource();
    else setSourceLoading(false);
  }, [craftId, loadSource, meta?.processingStatus, profile]);

  const handleRetry = useCallback(async () => {
    if (!craftId) return;
    setError(null);
    try {
      const data = await postApi<{ status: "processing"; craftId: string; meta: CraftMeta }>(`/crafts/${craftId}/retry`);
      setProfile(null);
      setMeta(data.meta);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : String(retryError));
    }
  }, [craftId]);

  const handleReparse = useCallback(async () => {
    if (!craftId || !source?.files.some((file) => file.key === "analysisInput") || reparsing) return;
    setReparsing(true);
    setError(null);
    try {
      const result = await fetchJson<{ profile: CraftProfile }>(`/crafts/${craftId}/reparse`, { method: "POST" });
      setProfile(result.profile);
      await loadSource();
    } catch (reparseError) {
      setError(reparseError instanceof Error ? reparseError.message : String(reparseError));
    } finally {
      setReparsing(false);
    }
  }, [craftId, loadSource, reparsing, source]);

  const handleRegenerateStorySeed = useCallback(async () => {
    if (!craftId || storySeedGenerating || meta?.storySeedStatus === "pending") return;
    const language = profile?.language ?? meta?.language ?? "zh";
    setStorySeedGenerating(true);
    setStorySeedStatus("generating");
    setStorySeedError(null);
    setStorySeedStreamedContent("");
    try {
      const result = await postApi<{ craftId: string; status: "pending"; meta: CraftMeta }>(`/crafts/${encodeURIComponent(craftId)}/story-seed/generate`, {
        craftId,
        kind: "short",
        language,
        ...(storySeed ? { previousDirection: serializeStorySeed(storySeed, language) } : {}),
      });
      setMeta(result.meta);
    } catch (generationError) {
      setStorySeedStatus("error");
      setStorySeedError(generationError instanceof Error ? generationError.message : String(generationError));
    } finally {
      setStorySeedGenerating(false);
    }
  }, [craftId, meta?.language, meta?.storySeedStatus, profile?.language, storySeed, storySeedGenerating]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (meta?.processingStatus === "processing") {
    return (
      <div className={`mx-auto w-full max-w-2xl space-y-5 rounded-2xl border ${c.cardStatic} p-6`}>
        <div className="flex items-center gap-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <div>
            <h2 className="text-lg font-semibold">正在创建写作模式</h2>
            <p className="mt-1 text-sm text-muted-foreground">{meta.sourceName}</p>
          </div>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
          <div className="text-sm font-medium text-primary">{meta.processingStage ?? "后台处理中"}</div>
        </div>
        <button
          type="button"
          onClick={() => void loadStatus()}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary/40"
        >
          <RefreshCw size={14} /> 刷新状态
        </button>
      </div>
    );
  }

  if (meta?.processingStatus === "error") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-6" role="alert">
        <div>
          <h2 className="text-lg font-semibold text-destructive">写作模式处理失败</h2>
          <p className="mt-1 text-sm text-muted-foreground">{meta.processingError ?? error ?? "后台任务失败"}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void handleRetry()}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${c.btnPrimary}`}
          >
            <RefreshCw size={14} /> 重试处理
          </button>
          <button type="button" onClick={onNew} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary/40">
            创建其他模式
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 py-12 text-center" role="alert">
        <p className="text-sm text-destructive">加载模式详情失败：{error}</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => void loadProfile()}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">{t("craft.noProfiles")}</p>
        <div className="flex justify-center">
          <button
            onClick={onNew}
            className={`rounded-lg px-3 py-1.5 text-sm ${c.btnPrimary}`}
          >
            {t("craft.newProfile")}
          </button>
        </div>
      </div>
    );
  }

  const detail = buildCraftDetailModel(profile);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-primary">
            {craftSourceTypeLabel(profile.sourceType)}
          </span>
          <span className="rounded-full border border-border/60 bg-secondary/20 px-2.5 py-1">
            {t("craft.moduleCount").replace("{count}", String(detail.moduleCount))}
          </span>
          <span className="rounded-full border border-border/60 bg-secondary/20 px-2.5 py-1">
            {t("craft.exemplarCount").replace("{count}", String(detail.exemplarCount))}
          </span>
          {source && <span className="rounded-full border border-border/60 bg-secondary/20 px-2.5 py-1">原始资料已保留</span>}
        </div>
        <button
          type="button"
          onClick={() => void handleReparse()}
          disabled={reparsing || sourceLoading || !source?.files.some((file) => file.key === "analysisInput")}
          className={`inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors ${
            reparsing || sourceLoading || !source?.files.some((file) => file.key === "analysisInput")
              ? "cursor-not-allowed opacity-50"
              : "hover:bg-secondary/40"
          }`}
          title={!source ? "该模式没有保留原始资料，无法重新解析" : undefined}
        >
          <RefreshCw size={14} className={reparsing ? "animate-spin" : undefined} />
          {reparsing ? "重新解析中…" : "重新解析"}
        </button>
      </div>

      <div className="overflow-x-auto border-b border-border">
        <div className="flex min-w-max gap-1">
          {CRAFT_DETAIL_TABS
            .filter((tab) => tab.value !== "video" || !!detail.videoStory)
            .map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setDetailTab(tab.value)}
                className={`border-b-2 px-3 py-2 text-sm transition-colors ${
                  detailTab === tab.value
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
        </div>
      </div>

      {detailTab === "story" && (
        <section className={`space-y-4 rounded-2xl border ${c.cardStatic} p-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-sm font-semibold">默认故事设定</h3>
            <button
              type="button"
              onClick={() => void handleRegenerateStorySeed()}
              disabled={storySeedGenerating || meta?.storySeedStatus === "pending"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {storySeedGenerating || meta?.storySeedStatus === "pending" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {storySeedGenerating ? "正在重新生成" : meta?.storySeedStatus === "pending" ? "后台生成中" : "重新随机生成"}
            </button>
          </div>
          {meta?.storySeedStatus === "pending" && !storySeedGenerating ? (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2 text-xs leading-5 text-primary">
              模式创建完成后正在后台生成默认故事设定。你可以先浏览其他页签，完成后刷新会自动显示。
            </div>
          ) : null}
          <StorySeedPreview
            streamedContent={storySeedStreamedContent}
            status={storySeedStatus}
            error={storySeedError}
            isZh={profile.language === "zh"}
          />
        </section>
      )}

      {detailTab === "overview" && craftId && (
        <section className={`border ${c.cardStatic} rounded-xl p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">画面风格</h3>
              <p className="mt-1 text-xs text-muted-foreground/70">
                角色和场景图片生成时使用的视觉风格。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={artStyle}
                onChange={(e) => void handleArtStyleChange(e.target.value as CraftArtStyle)}
                disabled={artStyleSaving}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[140px] disabled:opacity-50"
              >
                {CRAFT_ART_STYLES.map((style) => (
                  <option key={style.key} value={style.key}>{style.label}</option>
                ))}
              </select>
              {artStyleSaving && (
                <span className="text-xs text-muted-foreground">保存中…</span>
              )}
            </div>
          </div>
        </section>
      )}

      {detailTab === "overview" && (detail.worldview || detail.storyOutline) && (
        <section className="grid gap-3 md:grid-cols-2">
          {detail.worldview && (
            <div className={`border ${c.cardStatic} rounded-xl p-4 space-y-2`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">世界观</h3>
              <p className="text-sm leading-6 whitespace-pre-wrap">{detail.worldview}</p>
            </div>
          )}
          {detail.storyOutline && (
            <div className={`border ${c.cardStatic} rounded-xl p-4 space-y-2`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">故事大纲</h3>
              <p className="text-sm leading-6 whitespace-pre-wrap">{detail.storyOutline}</p>
            </div>
          )}
        </section>
      )}

      {detailTab === "video" && detail.videoStory && (
        <section className={`space-y-4 rounded-2xl border ${c.cardStatic} p-4`}>
          <div>
            {detail.videoStory.wordCountEstimate && (
              <div className="mt-3 rounded-xl border border-primary/25 bg-primary/[0.05] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-xs font-medium text-muted-foreground">目标字数</div>
                  <div className="text-lg font-semibold text-primary">
                    目标 {detail.videoStory.wordCountEstimate.recommended.toLocaleString()} 字
                  </div>
                </div>
                <div className="mt-2 text-xs leading-5 text-muted-foreground">
                  {detail.videoStory.wordCountEstimate.rationale}
                </div>
              </div>
            )}
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {[
                ["一句话梗概", detail.videoStory.logline],
                ["观众承诺", detail.videoStory.audiencePromise],
                ["节奏曲线", detail.videoStory.pacingCurve],
                ["开场钩子", detail.videoStory.hookStrategy],
                ["高潮策略", detail.videoStory.climaxStrategy],
                ["结尾余韵", detail.videoStory.endingAftertaste],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <div className="text-xs font-medium text-muted-foreground">{label}</div>
                  <div className="mt-1 text-sm leading-6">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="text-xs font-medium text-muted-foreground">视频大纲</div>
              <div className="mt-1 whitespace-pre-wrap text-sm leading-6">{detail.videoStory.outline}</div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">剧情节拍</div>
            <div className="space-y-2">
              {detail.videoStory.beats.map((beat) => {
                const durationLabel = formatCraftBeatDuration(beat.timeRange);
                return (
                  <div key={`${beat.order}-${beat.position}`} className="rounded-xl border border-border/60 bg-background/40 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{Math.round(beat.position * 100)}%</span>
                      {durationLabel && <span className="text-muted-foreground">{durationLabel}</span>}
                      <span className="rounded-full bg-secondary/30 px-2 py-0.5 text-muted-foreground">{beat.kind}</span>
                    </div>
                    <div className="mt-2 text-sm font-medium">{beat.event}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">功能：{beat.function} · 情绪：{beat.emotionalEffect}</div>
                    {beat.evidence && <div className="mt-1 text-xs text-muted-foreground">证据：{beat.evidence}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">反转节点</div>
              <div className="space-y-2">
                {detail.videoStory.reversals.map((reversal) => (
                  <div key={`${reversal.order}-${reversal.position}`} className="text-sm leading-6">
                    <div className="font-medium">{Math.round(reversal.position * 100)}% · {reversal.reveal}</div>
                    <div className="text-xs text-muted-foreground">表面认知：{reversal.apparentTruth}</div>
                    <div className="text-xs text-muted-foreground">触发：{reversal.trigger} · 重释线索：{reversal.reinterpretedClues}</div>
                    <div className="text-xs text-muted-foreground">铺垫节拍：{reversal.setupBeatOrders.join("、") || "未记录"} · 情绪：{reversal.emotionalEffect}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">爽点与情绪释放</div>
              <div className="space-y-2">
                {detail.videoStory.payoffs.map((payoff) => (
                  <div key={`${payoff.order}-${payoff.position}`} className="text-sm leading-6">
                    <div className="font-medium">{Math.round(payoff.position * 100)}% · {payoff.release}</div>
                    <div className="text-xs text-muted-foreground">铺垫：{payoff.setup}</div>
                    <div className="text-xs text-muted-foreground">代价/后果：{payoff.costOrConsequence} · 情绪：{payoff.emotionalEffect}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {detail.videoStory.originalizationRules.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3">
              <div className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-300">原创化约束</div>
              <ul className="space-y-1 text-sm leading-6">
                {detail.videoStory.originalizationRules.map((rule) => <li key={rule}>· {rule}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {detailTab === "modules" && <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("craft.breakdownModules")}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {detail.modules.map((module) => (
            <div key={`${module.category}-${module.label}`} className={`border ${c.cardStatic} rounded-xl p-4 space-y-2`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{module.label}</div>
                <span className="text-[11px] rounded-full bg-secondary/30 px-2 py-0.5 text-muted-foreground">
                  {craftModuleCategoryLabel(module.category, profile.language)}
                </span>
              </div>
              <div className="text-sm leading-6 text-foreground/90">{module.summary}</div>
              {module.evidence && (
                <div className="rounded-lg bg-secondary/20 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  <div className="mb-1 font-medium uppercase tracking-wider">{t("craft.moduleEvidence")}</div>
                  {module.evidence}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>}

      {detailTab === "overview" && <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("craft.legacySummary")}</h3>
        <CraftSection title={t("craft.structure")} fields={[
          [t("craft.openingPattern"), profile.structure.openingPattern],
          [t("craft.chapterArc"), profile.structure.chapterArc],
          [t("craft.endingHook"), profile.structure.endingHookType],
        ]} exemplar={profile.structure.exemplar} c={c} />

        <CraftSection title={t("craft.sceneRhythm")} fields={[
          [t("craft.sceneTransition"), profile.sceneRhythm.sceneTransitionTechnique],
          [t("craft.pacingCurve"), profile.sceneRhythm.pacingCurve],
          [t("craft.conflictEscalation"), profile.sceneRhythm.conflictEscalation],
        ]} exemplar={profile.sceneRhythm.exemplar} c={c} />

        <CraftSection title={t("craft.infoDisclosure")} fields={[
          [t("craft.foreshadowing"), profile.informationDisclosure.foreshadowingDensity],
          [t("craft.infoRelease"), profile.informationDisclosure.informationReleaseRhythm],
          [t("craft.suspense"), profile.informationDisclosure.suspenseManagement],
        ]} exemplar={profile.informationDisclosure.exemplar} c={c} />

        <CraftSection title={t("craft.narrativePOV")} fields={[
          [t("craft.povStrategy"), profile.narrativePerspective.povStrategy],
          [t("craft.dialogueRatio"), profile.narrativePerspective.narrationDialogueRatio],
          [t("craft.narrativeDistance"), profile.narrativePerspective.narrativeDistance],
        ]} exemplar={profile.narrativePerspective.exemplar} c={c} />
      </section>}

      {/* Exemplars */}
      {detailTab === "exemplars" && profile.exemplars.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{t("craft.exemplars")}</h3>
          <div className="space-y-2">
            {profile.exemplars.map((ex, i) => (
              <div key={i} className={`border ${c.cardStatic} rounded-lg p-3`}>
                <div className="text-xs font-medium mb-1">{ex.label}（{ex.tone}）</div>
                <div className="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">{ex.excerpt}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {detailTab === "source" && (
        <section className={`space-y-4 rounded-2xl border ${c.cardStatic} p-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            {source && <span className="text-xs text-muted-foreground">导入于 {new Date(source.importedAt).toLocaleString()}</span>}
          </div>

          {sourceLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />正在读取原始资料…</div>
          ) : sourceError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">读取原始资料失败：{sourceError}</div>
          ) : !source ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">这个模式没有保留原始资料，因此不能重新解析。</div>
          ) : (
            <div className="space-y-4">
              {source.files.some((file) => file.key === "video") && (
                <video
                  controls
                  preload="metadata"
                  className="aspect-video w-full rounded-xl border border-border bg-black"
                  src={`/api/v1/crafts/${craftId}/source/video`}
                />
              )}

              {/* Subtitle viewer */}
              {source.files.some((file) => file.key === "subtitlesText") && (
                <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">字幕数据</span>
                    <button
                      onClick={async () => {
                        if (subtitleText !== null) {
                          setSubtitleText(null);
                          return;
                        }
                        setSubtitleLoading(true);
                        try {
                          const res = await fetch(`/api/v1/crafts/${craftId}/source/subtitlesText`);
                          const text = await res.text();
                          setSubtitleText(text);
                        } catch {
                          setSubtitleText("加载字幕失败");
                        } finally {
                          setSubtitleLoading(false);
                        }
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      {subtitleLoading ? "加载中…" : subtitleText !== null ? "收起字幕" : "查看字幕"}
                    </button>
                  </div>
                  {subtitleText !== null && (
                    <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-3 text-xs leading-5 text-foreground/80 font-mono">
                      {subtitleText}
                    </pre>
                  )}
                </div>
              )}

              <div className="grid gap-2 md:grid-cols-2">
                {source.files.map((file) => (
                  <a
                    key={file.key}
                    href={`/api/v1/crafts/${craftId}/source/${file.key}`}
                    download={file.downloadName}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-3 transition-colors hover:bg-secondary/30"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {file.key === "video" ? <Video size={16} className="shrink-0 text-primary" /> : file.key === "source" ? <FileArchive size={16} className="shrink-0 text-primary" /> : <FileText size={16} className="shrink-0 text-primary" />}
                      <span className="min-w-0 truncate text-sm">{craftSourceFileLabel(file.key, file.downloadName)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><span>{formatCraftSourceSize(file.size)}</span><Download size={14} /></span>
                  </a>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {source.sourceDurationSeconds ? <span>视频时长：{Math.round(source.sourceDurationSeconds / 60)} 分钟</span> : null}
                {source.subtitleSource ? <span>字幕来源：{source.subtitleSource === "bili" ? "B 站" : "必剪转写"}</span> : null}
                {source.sourceRef ? <span className="max-w-full truncate">来源：{source.sourceRef}</span> : null}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Craft section (reused from original)
// ---------------------------------------------------------------------------

function CraftSection({ title, fields, exemplar, c }: {
  title: string;
  fields: ReadonlyArray<[string, string]>;
  exemplar?: string;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <div className={`border ${c.cardStatic} rounded-lg p-4 space-y-3`}>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="space-y-1.5">
        {fields.map(([label, value]) => (
          <div key={label} className="text-sm flex gap-2">
            <span className="text-muted-foreground min-w-fit shrink-0">{label}:</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
      {exemplar && (
        <div className="mt-2 bg-secondary/20 rounded-lg p-3">
          <div className="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">{exemplar}</div>
        </div>
      )}
    </div>
  );
}

function craftSourceFileLabel(key: CraftSourceFileKey, downloadName: string): string {
  if (key === "video") return "视频文件（保留原始下载）";
  if (key === "subtitlesJson") return "字幕数据（JSON）";
  if (key === "subtitlesText") return "字幕文本";
  if (key === "analysisInput") return "解析输入文本";
  return `原始文件：${downloadName}`;
}

function formatCraftSourceSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
