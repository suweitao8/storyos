import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson, putApi, useApi, postApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import type { SSEMessage } from "../hooks/use-sse";
import { useNewSSEMessages } from "../hooks/use-sse";
import { usePageToolbar } from "../components/PageToolbar";
import { normalizeCraftDisplayName } from "./craft-name.js";
import {
  type CraftTab,
  resolveAfterCraftDelete,
  resolveInitialCraftState,
} from "./craft-navigation-state";
import { deriveCraftBreakdownModules } from "@actalk/inkos-core/agents/craft-breakdown";
import {
  Wand2, BookOpen, Trash2, ChevronRight,
  Plus, FileUp, Loader2, ArrowLeft, FileText,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CraftMeta {
  readonly id: string;
  readonly sourceName: string;
  readonly createdAt: string;
  readonly language: "zh" | "en";
  readonly mode?: "general" | "ghost-story";
}

interface CraftListResponse {
  readonly crafts: ReadonlyArray<CraftMeta>;
  readonly recentCraftId: string | null;
  readonly recentCraftPreferenceAvailable: boolean;
}

interface BilibiliImportResponse {
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
  readonly subtitlePreview: ReadonlyArray<{
    readonly from: number;
    readonly to: number;
    readonly content: string;
  }>;
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
  readonly worldview?: string;
  readonly storyOutline?: string;
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
}

export function buildCraftDetailModel(profile: CraftProfile): CraftDetailModel {
  const modules = deriveCraftBreakdownModules(profile) as ReadonlyArray<CraftModule>;

  return {
    moduleCount: modules.length,
    exemplarCount: profile.exemplars.length,
    modules,
    worldview: profile.worldview,
    storyOutline: profile.storyOutline,
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
  const [tab, setTab] = useState<CraftTab>("list");
  const [selectedCraftId, setSelectedCraftId] = useState<string | null>(null);
  const [newProfile, setNewProfile] = useState<CraftProfile | null>(null);
  const initialNavigationAppliedRef = useRef(false);
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

  useEffect(() => {
    if (craftsLoading || !craftsData || initialNavigationAppliedRef.current) return;
    initialNavigationAppliedRef.current = true;
    if (userNavigatedRef.current || !craftsData.recentCraftPreferenceAvailable) return;

    const initialState = resolveInitialCraftState(
      craftsData.recentCraftId,
      craftsData.crafts.map((craft) => craft.id),
    );
    setTab(initialState.tab);
    selectedCraftIdRef.current = initialState.selectedCraftId;
    setSelectedCraftId(initialState.selectedCraftId);
  }, [craftsData, craftsLoading]);

  const openDetail = (craftId: string) => {
    markUserNavigation();
    selectedCraftIdRef.current = craftId;
    setSelectedCraftId(craftId);
    setNewProfile(null);
    setTab("detail");
    void persistRecentCraft(craftId);
  };

  const handleCreated = async (profile: CraftProfile, craftId: string) => {
    markUserNavigation();
    setNewProfile(profile);
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
        latest.crafts.map((craft) => craft.id),
      );
      if (!deletion.shouldPersistRecentCraft) return;

      setTab(deletion.selectedCraftId ? "detail" : "list");
      selectedCraftIdRef.current = deletion.selectedCraftId;
      setSelectedCraftId(deletion.selectedCraftId);
      setNewProfile(null);
      await persistRecentCraft(deletion.selectedCraftId);
    } catch {
      // Keep the current view intact when deletion or refresh fails.
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
        craftsLoading ? (
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
            onNew={openCreate}
            onOpen={openDetail}
            onDelete={handleDelete}
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
          c={c}
          t={t}
          onBack={openList}
          onNew={openCreate}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Craft list
// ---------------------------------------------------------------------------

function CraftList({ crafts, selectedCraftId, c, t, onNew, onOpen, onDelete }: {
  crafts: ReadonlyArray<CraftMeta>;
  selectedCraftId: string | null;
  c: ReturnType<typeof useColors>;
  t: TFunction;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  if (crafts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="border border-dashed border-border/40 rounded-xl p-12 text-center">
          <Wand2 size={32} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">{t("craft.noProfiles")}</p>
          <button
            onClick={onNew}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg ${c.btnPrimary}`}
          >
            <Plus size={14} />
            {t("craft.newProfile")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={onNew}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg ${c.btnPrimary}`}
        >
          <Plus size={14} />
          {t("craft.newProfile")}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {crafts.map((craft) => (
        <div
          key={craft.id}
          className={craftListRowClassName(craft.id === selectedCraftId, c.cardStatic)}
        >
          <button onClick={() => onOpen(craft.id)} className="flex min-w-0 flex-1 flex-col items-start gap-3 pr-8 text-left">
            <ChevronRight size={16} className="text-muted-foreground" />
            <span className="font-medium text-sm">{normalizeCraftDisplayName(craft.sourceName)}</span>
            {craft.mode === "ghost-story" && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">鬼故事</span>
            )}
            <span className="text-xs text-muted-foreground">{craft.language}</span>
            <span className="text-xs text-muted-foreground">{new Date(craft.createdAt).toLocaleDateString()}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); void onDelete(craft.id); }}
            className="absolute right-4 top-4 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Create (upload + extract)
// ---------------------------------------------------------------------------

interface UploadResponse {
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
  onSuccess: (profile: CraftProfile, craftId: string) => void;
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
  const [sourceName, setSourceName] = useState("");
  const [craftMode, setCraftMode] = useState<"general" | "ghost-story">("general");
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
      setSourceName(normalizeCraftDisplayName(data.detectedName));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    }
    setUploading(false);
  };

  const handleBilibiliImport = async () => {
    if (!bilibiliUrl.trim()) return;
    setImportingBilibili(true);
    setBilibiliError("");
    setBilibiliResult(null);
    setUploadResult(null);
    setUploadError("");
    setExtractError("");
    setCurrentStep("正在读取 B 站视频信息");
    setProgressLogs(["正在读取 B 站视频信息", "优先查找公开 CC 字幕，不需要 Cookie"]);
    try {
      const response = await fetch("/api/v1/craft/bilibili/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: bilibiliUrl.trim() }),
      });
      const data = await response.json() as BilibiliImportResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? `字幕获取失败（${response.status}）`);
      setBilibiliResult(data);
      setSourceName(normalizeCraftDisplayName(data.detectedName));
      setCurrentStep(`字幕获取完成，共 ${data.subtitleCount} 条`);
      setProgressLogs((prev) => [...prev, `字幕获取完成，共 ${data.subtitleCount} 条`]);
    } catch (e) {
      setBilibiliError(e instanceof Error ? e.message : String(e));
      setCurrentStep("B 站字幕获取失败");
      setProgressLogs((prev) => [...prev, "B 站字幕获取失败"]);
    } finally {
      setImportingBilibili(false);
    }
  };

  const handleExtract = async () => {
    if ((!uploadResult && !bilibiliResult) || !sourceName.trim()) return;
    const nextSourceName = sourceName.trim();
    activeSourceNameRef.current = nextSourceName;
    setExtracting(true);
    setExtractError("");
    setCurrentStep(t("craft.progressWaiting"));
    setProgressLogs([]);
    try {
      const result = await postApi<{ craftId: string; profile: CraftProfile }>("/craft/analyze", {
        text: bilibiliResult?.text ?? uploadResult?.text ?? "",
        sourceName: nextSourceName,
        language: "zh",
        mode: craftMode,
      });
      onSuccess(result.profile, result.craftId);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : String(e));
    }
    setExtracting(false);
  };

  const busy = uploading || importingBilibili || extracting;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="rounded-2xl border border-border/60 bg-secondary/10 p-4 space-y-2">
        <label htmlFor="craft-mode" className="text-sm font-medium">模式类型</label>
        <select
          id="craft-mode"
          value={craftMode}
          onChange={(event) => setCraftMode(event.target.value === "ghost-story" ? "ghost-story" : "general")}
          disabled={busy}
          className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="general">通用写作模式</option>
          <option value="ghost-story">鬼故事模式</option>
        </select>
        <p className="text-xs leading-5 text-muted-foreground">
          选择鬼故事模式后，会额外提取恐惧核心、超自然规则、禁忌、线索链、惊吓节奏和结尾余韵，并用于短篇仿写。
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-secondary/10 p-4 space-y-3">
        <div>
          <div className="text-sm font-medium">B 站视频字幕</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            只获取字幕，不保存完整视频。不需要 Cookie，优先读取公开 CC 字幕；没有公开字幕时会临时尝试音频识别。
          </p>
        </div>
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
            {importingBilibili ? "获取字幕中" : "获取字幕"}
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
            <div className="max-h-40 overflow-auto rounded-lg border border-border/60 bg-secondary/20 p-2 text-xs leading-5 text-muted-foreground">
              {bilibiliResult.subtitlePreview.map((entry) => (
                <div key={`${entry.from}-${entry.to}-${entry.content}`}>[{entry.from.toFixed(1)}s] {entry.content}</div>
              ))}
            </div>
          </div>
        )}
      </div>

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
            <span className="font-medium">{normalizeCraftDisplayName(sourceName || uploadResult?.detectedName || bilibiliResult?.detectedName || "")}</span>
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

      {/* Source name + extract button */}
      {(uploadResult || bilibiliResult) && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              {t("craft.sourceNameLabel")}
            </label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <button
            onClick={handleExtract}
            disabled={!sourceName.trim() || busy}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg ${c.btnPrimary} disabled:opacity-30`}
          >
            {extracting ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {extracting ? t("craft.extracting") : t("craft.extract")}
          </button>
        </div>
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

function CraftDetail({ craftId, initialProfile, c, t, onBack, onNew }: {
  craftId: string | null;
  initialProfile: CraftProfile | null;
  c: ReturnType<typeof useColors>;
  t: TFunction;
  onBack: () => void;
  onNew: () => void;
}) {
  const [profile, setProfile] = useState<CraftProfile | null>(initialProfile);
  const [loading, setLoading] = useState(!initialProfile && !!craftId);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!craftId || initialProfile) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<CraftProfile>(`/crafts/${craftId}`, { method: "GET" });
      setProfile(data);
    } catch (loadError) {
      setProfile(null);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [craftId, initialProfile]);

  useEffect(() => {
    setProfile(initialProfile);
    setError(null);
    if (!craftId || initialProfile) {
      setLoading(false);
      return;
    }
    void loadProfile();
  }, [craftId, initialProfile, loadProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
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
          <button
            onClick={onBack}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("craft.backToList")}
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">{t("craft.noProfiles")}</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("craft.backToList")}
          </button>
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-sm">
          <ArrowLeft size={16} />
          {t("craft.backToList")}
        </button>
      </div>

      <div className="space-y-2">
        <h2 className="font-serif text-2xl">{normalizeCraftDisplayName(profile.sourceName)}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {profile.mode === "ghost-story" && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-primary">鬼故事模式</span>
          )}
          <span className="rounded-full border border-border/60 bg-secondary/20 px-2.5 py-1">
            {t("craft.moduleCount").replace("{count}", String(detail.moduleCount))}
          </span>
          <span className="rounded-full border border-border/60 bg-secondary/20 px-2.5 py-1">
            {t("craft.exemplarCount").replace("{count}", String(detail.exemplarCount))}
          </span>
        </div>
      </div>

      {(detail.worldview || detail.storyOutline) && (
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

      {profile.mode === "ghost-story" && profile.ghostStory && (
        <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">鬼故事仿写约束</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["恐惧核心", profile.ghostStory.fearCore],
              ["超自然规则", profile.ghostStory.supernaturalRules],
              ["禁忌与触发条件", profile.ghostStory.taboos],
              ["主角脆弱点", profile.ghostStory.protagonistVulnerability],
              ["线索系统", profile.ghostStory.clueSystem],
              ["真相揭示节奏", profile.ghostStory.revealCadence],
              ["惊吓节奏", profile.ghostStory.scareCadence],
              ["恐怖升级阶梯", profile.ghostStory.escalationLadder],
              ["感官母题", profile.ghostStory.sensoryMotifs],
              ["结尾余韵", profile.ghostStory.endingAftertaste],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="text-xs font-medium text-muted-foreground">{label}</div>
                <div className="mt-1 text-sm leading-6">{value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
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
      </section>

      <section className="space-y-3">
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
      </section>

      {/* Exemplars */}
      {profile.exemplars.length > 0 && (
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
