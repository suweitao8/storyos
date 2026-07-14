import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, RefreshCw } from "lucide-react";
import type { StorySeed } from "@actalk/inkos-core";
import type { Theme } from "../hooks/use-theme";
import { useColors } from "../hooks/use-colors";
import type { CraftOption } from "./story-creation-state";
import { craftModeLabel } from "./craft-reference-mode";
import { StorySeedPreview } from "./StorySeedPreview";
import {
  serializeStorySeed,
  type StorySeedGenerationInput,
  type StorySeedGenerationStatus,
  type StorySeedStreamEvent,
} from "./story-seed-stream";
import {
  buildDefaultStoryDirection,
  buildStoryWordCountOptions,
  formatStoryWordCount,
  resolveDefaultStoryWordCount,
  resolveStorySeedGenerationStatus,
  type LongStoryCreationInput,
  type ShortStoryCreationInput,
  type StoryDirectionGenerationInput,
} from "./story-creation-state";

export type { CraftOption } from "./story-creation-state";

export const STORY_CREATION_LAYOUT_CLASSES = {
  workspace: "flex h-full w-full min-w-0 flex-col overflow-y-auto px-4 py-6 md:px-8 xl:px-10",
  columns: "grid min-h-0 gap-6",
} as const;

interface StoryCreationPanelProps {
  readonly kind: "long" | "short";
  readonly theme: Theme;
  readonly isZh: boolean;
  readonly activeSessionId: string | null;
  readonly busy: boolean;
  readonly crafts: ReadonlyArray<CraftOption>;
  readonly craftsLoading: boolean;
  readonly craftsError?: string | null;
  readonly selectedCraftId: string;
  readonly onCraftChange: (craftId: string) => void;
  readonly onCreateLong: (input: LongStoryCreationInput) => Promise<void>;
  readonly onCreateShort: (input: ShortStoryCreationInput) => Promise<void>;
  readonly onGenerateDirection?: (input: StoryDirectionGenerationInput) => Promise<string>;
  readonly onGenerateSeed?: (input: StorySeedGenerationInput, onEvent: (event: StorySeedStreamEvent) => void) => Promise<StorySeed>;
  readonly onSaveSeed?: (craftId: string, seed: StorySeed, generationId?: string) => Promise<void>;
  readonly onOpenCraft?: () => void;
}

export function StoryCreationPanel({
  kind,
  theme,
  isZh,
  activeSessionId,
  busy,
  crafts,
  craftsLoading,
  craftsError,
  selectedCraftId,
  onCraftChange,
  onCreateLong,
  onCreateShort,
  onGenerateDirection,
  onGenerateSeed,
  onSaveSeed,
  onOpenCraft,
}: StoryCreationPanelProps) {
  const c = useColors(theme);
  const [longTitle, setLongTitle] = useState("");
  const [longGenre, setLongGenre] = useState("");
  const [longDirection, setLongDirection] = useState("");
  const [chapterWordCount, setChapterWordCount] = useState("10000");
  const [shortDirection, setShortDirection] = useState("");
  const [shortSeed, setShortSeed] = useState<StorySeed | null>(null);
  const [shortSeedStreamedContent, setShortSeedStreamedContent] = useState("");
  const [shortSeedStatus, setShortSeedStatus] = useState<StorySeedGenerationStatus>("idle");
  const [shortSeedError, setShortSeedError] = useState<string | null>(null);
  const [shortQuality, setShortQuality] = useState<"standard" | "quick">("standard");
  const [directionGenerating, setDirectionGenerating] = useState(false);
  const [directionGenerationError, setDirectionGenerationError] = useState<string | null>(null);
  const directionRequestRef = useRef(0);
  // Tracks whether the current shortSeed was produced by a live stream in
  // this session. When the auto-save after generation triggers a refetch and
  // re-runs the effect, the "cache hit" branch must NOT clobber the already
  // rendered streamed content.
  const seedAlreadyReadyRef = useRef(false);
  // Last craft id the seed state was built for; switching crafts resets the
  // guard so the new craft's cached seed (if any) loads normally.
  const lastCraftIdRef = useRef<string | undefined>(undefined);

  const selectedCraft = crafts.find((craft) => craft.id === selectedCraftId);
  const hasCraftSelection = Boolean(selectedCraftId && selectedCraft);
  const selectedCraftRecommendedWordCount = selectedCraft?.recommendedWordCount
    ? resolveDefaultStoryWordCount(selectedCraft?.recommendedWordCount)
    : undefined;

  useEffect(() => {
    if (kind === "short") {
      // Reset the "already ready" guard when switching to a different craft,
      // so its cached seed loads cleanly.
      if (lastCraftIdRef.current !== selectedCraft?.id) {
        lastCraftIdRef.current = selectedCraft?.id;
        seedAlreadyReadyRef.current = false;
      }
      if (craftsLoading) {
        setShortSeedStatus("idle");
        return;
      }
      if (selectedCraft) setShortDirection(buildDefaultStoryDirection(selectedCraft, kind, isZh));
      else setShortDirection("");
      const cachedSeed = selectedCraft?.storySeed;
      if (cachedSeed) {
        // If we just finished streaming this seed (auto-save → refetch →
        // effect re-run), keep the rendered content intact.
        if (seedAlreadyReadyRef.current) {
          setShortSeedStatus("ready");
          return;
        }
        // Backfill the preview from the cached seed so the "ready" state
        // always has content to show — otherwise the body falls back to the
        // "waiting for model output" placeholder while the header says
        // "generated, ready to confirm", which is contradictory.
        const serialized = serializeStorySeed(cachedSeed, isZh ? "zh" : "en");
        setShortSeed(cachedSeed);
        setShortDirection(serialized);
        setShortSeedStreamedContent(serialized);
        setShortSeedError(null);
        setShortSeedStatus("ready");
        return;
      }
      setShortSeed(null);
      setShortSeedStreamedContent("");
      setShortSeedError(selectedCraft?.storySeedError ?? null);
      setShortSeedStatus(resolveStorySeedGenerationStatus(selectedCraft));
      return;
    }

    if (!selectedCraft) {
      ++directionRequestRef.current;
      setLongDirection("");
      setDirectionGenerating(false);
      setDirectionGenerationError(null);
      return;
    }
    const defaultDirection = buildDefaultStoryDirection(selectedCraft, kind, isZh);
    setLongDirection(defaultDirection);
    setDirectionGenerationError(null);
    setDirectionGenerating(false);
  }, [craftsLoading, isZh, kind, selectedCraft?.id, selectedCraft?.storySeed, selectedCraft?.storySeedError, selectedCraft?.storySeedStatus]);

  useEffect(() => {
    setChapterWordCount(String(resolveDefaultStoryWordCount(selectedCraft?.recommendedWordCount)));
  }, [selectedCraftId, selectedCraft?.recommendedWordCount]);

  const wordCountOptions = buildStoryWordCountOptions(selectedCraft?.recommendedWordCount);

  const regenerateDirection = () => {
    if (kind === "short") {
      if (!onGenerateSeed || directionGenerating || shortSeedStatus === "generating") return;
      const requestId = ++directionRequestRef.current;
      setShortSeedStatus("generating");
      setShortSeedError(null);
      setShortSeed(null);
      setShortSeedStreamedContent("");
      seedAlreadyReadyRef.current = false;
      let streamGenerationId: string | undefined;
      void onGenerateSeed({
        ...(selectedCraft ? { craftId: selectedCraft.id } : {}),
        kind,
        language: isZh ? "zh" : "en",
        previousDirection: shortSeed ? serializeStorySeed(shortSeed, isZh ? "zh" : "en") : shortDirection,
      }, (event) => {
        if (requestId !== directionRequestRef.current) return;
        if (typeof event.data.generationId === "string") streamGenerationId = event.data.generationId;
        if (event.event === "delta" && typeof event.data.text === "string") {
          setShortSeedStreamedContent((current) => current + event.data.text);
        }
      })
        .then((seed) => {
          if (requestId !== directionRequestRef.current) return;
          setShortSeed(seed);
          setShortDirection(serializeStorySeed(seed, isZh ? "zh" : "en"));
          setShortSeedStatus("ready");
          seedAlreadyReadyRef.current = true;
          if (selectedCraft && onSaveSeed) {
            void onSaveSeed(selectedCraft.id, seed, streamGenerationId).catch((error) => {
              if (requestId !== directionRequestRef.current) return;
              setShortSeedError(isZh ? `已生成，但保存到写作模式失败：${error instanceof Error ? error.message : String(error)}` : `Generated, but saving to the writing mode failed: ${error instanceof Error ? error.message : String(error)}`);
            });
          }
        })
        .catch((error) => {
          if (requestId !== directionRequestRef.current) return;
          setShortSeedError(error instanceof Error ? error.message : String(error));
          setShortSeedStatus("error");
        });
      return;
    }
    if (!selectedCraft || !onGenerateDirection || directionGenerating) return;
    const previousDirection = kind === "long" ? longDirection : shortDirection;
    const requestId = ++directionRequestRef.current;
    setDirectionGenerating(true);
    setDirectionGenerationError(null);
    void onGenerateDirection({
      craftId: selectedCraft.id,
      kind,
      language: isZh ? "zh" : "en",
      previousDirection,
    })
      .then((direction) => {
        if (requestId !== directionRequestRef.current) return;
        if (kind === "long") setLongDirection(direction);
        else setShortDirection(direction);
      })
      .catch((error) => {
        if (requestId === directionRequestRef.current) {
          setDirectionGenerationError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (requestId === directionRequestRef.current) setDirectionGenerating(false);
      });
  };

  const canCreate = Boolean(
    activeSessionId
      && (kind === "long"
        ? longTitle.trim() && longGenre.trim() && longDirection.trim()
        : shortSeed
          ? Boolean(shortSeed.title?.trim() && shortSeed.worldview?.trim() && shortSeed.outline?.trim())
          : shortDirection.trim()),
  );

  const handleSubmit = () => {
    if (!canCreate || busy) return;
    if (kind === "long") {
      void onCreateLong({
        title: longTitle,
        genre: longGenre,
        direction: longDirection,
        language: isZh ? "zh" : "en",
        chapterWordCount: Number(chapterWordCount),
        ...(hasCraftSelection ? { craftId: selectedCraftId } : {}),
      });
      return;
    }
    void onCreateShort({
      direction: shortSeed ? serializeStorySeed(shortSeed, isZh ? "zh" : "en") : shortDirection,
      chapterWordCount: Number(chapterWordCount),
      quality: shortQuality,
      ...(hasCraftSelection ? { craftId: selectedCraftId } : {}),
    });
  };

  return (
    <div className={STORY_CREATION_LAYOUT_CLASSES.workspace}>
      <div className={STORY_CREATION_LAYOUT_CLASSES.columns}>
        <div className="min-w-0 space-y-5">
      <div className="rounded-2xl border border-border/60 bg-secondary/10 p-5">
        {/* Row 1: 写作模式 + 生成质量 */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="story-craft-select" className="text-sm font-medium">
              {isZh ? "写作模式" : "Writing mode"}
            </label>
            <select
              id="story-craft-select"
              aria-label={isZh ? "写作模式" : "Writing mode"}
              value={selectedCraftId}
              onChange={(event) => onCraftChange(event.target.value)}
              disabled={busy || (craftsLoading && crafts.length === 0)}
              className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50"
            >
              <option value="">{isZh ? "不使用写作模式" : "No writing mode"}</option>
              {crafts.map((craft) => (
                <option key={craft.id} value={craft.id}>
                  {craft.sourceName}{craftModeLabel(craft.mode, craft.sourceType) ? ` · ${craftModeLabel(craft.mode, craft.sourceType)}` : ""}
                </option>
              ))}
            </select>
            {craftsLoading && crafts.length === 0 ? <p className="text-xs text-muted-foreground">{isZh ? "正在加载写作模式…" : "Loading writing modes…"}</p> : null}
            {craftsError ? <p className="text-xs text-destructive">{isZh ? `加载失败：${craftsError}` : `Failed to load: ${craftsError}`}</p> : null}
            {selectedCraft ? (
              <p className="text-xs leading-5 text-primary">
                {isZh
                  ? `当前使用：${selectedCraft.sourceName}${craftModeLabel(selectedCraft.mode, selectedCraft.sourceType) ? `（${craftModeLabel(selectedCraft.mode, selectedCraft.sourceType)}）` : ""}`
                  : `Using: ${selectedCraft.sourceName}${craftModeLabel(selectedCraft.mode, selectedCraft.sourceType) ? ` (${craftModeLabel(selectedCraft.mode, selectedCraft.sourceType)})` : ""}`}
              </p>
            ) : (
              <div className="flex items-center justify-between gap-3 text-xs leading-5 text-muted-foreground">
                <span>{isZh ? "未选择模式，将使用默认写作规则。" : "No mode selected; default writing rules will be used."}</span>
                {onOpenCraft ? (
                  <button type="button" onClick={onOpenCraft} className="shrink-0 text-primary hover:underline">
                    {isZh ? "去创建模式" : "Create a mode"}
                  </button>
                ) : null}
              </div>
            )}
          </div>
          {kind === "short" ? (
            <label className="space-y-2 text-sm">
              <span>{isZh ? "生成质量" : "Generation quality"}</span>
              <select
                value={shortQuality}
                onChange={(event) => setShortQuality(event.target.value as "standard" | "quick")}
                className="w-full rounded-lg border border-border bg-secondary/20 px-3 py-2 outline-none focus:border-primary"
              >
                <option value="standard">{isZh ? "标准：包含审纲和审稿" : "Standard: outline and draft review"}</option>
                <option value="quick">{isZh ? "极速：跳过审查" : "Quick: skip reviews"}</option>
              </select>
            </label>
          ) : (
            <div />
          )}
        </div>
        {/* Row 2: 每章字数 + 重新随机生成 */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span>{isZh ? "每章字数" : "Words / chapter"}</span>
            <select value={chapterWordCount} onChange={(event) => setChapterWordCount(event.target.value)} className="w-full rounded-lg border border-border bg-secondary/20 px-3 py-2 outline-none focus:border-primary">
              {wordCountOptions.map((count) => <option key={count} value={count}>{formatStoryWordCount(count, isZh ? "zh" : "en")}{count === selectedCraftRecommendedWordCount ? (isZh ? "（模式建议）" : " (mode recommendation)") : ""}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={regenerateDirection}
              disabled={busy || directionGenerating || shortSeedStatus === "generating" || !((kind === "long" && onGenerateDirection && selectedCraft) || (kind === "short" && onGenerateSeed))}
              aria-label={isZh ? "重新随机生成故事设定" : "Regenerate story foundation"}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {directionGenerating || shortSeedStatus === "generating" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {directionGenerating || shortSeedStatus === "generating" ? (isZh ? "正在生成" : "Generating") : (isZh ? "重新随机生成" : "Regenerate")}
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-4 rounded-xl border border-border/50 bg-background/35 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">{isZh ? "故事类型" : "Story type"}</dt><dd className="mt-1 font-medium">{kind === "long" ? (isZh ? "长篇故事" : "Long story") : (isZh ? "短篇故事" : "Short story")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{isZh ? "写作模式" : "Writing mode"}</dt><dd className="mt-1 truncate font-medium">{selectedCraft ? selectedCraft.sourceName : (isZh ? "默认规则" : "Default rules")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{isZh ? "每章字数" : "Words / chapter"}</dt><dd className="mt-1 font-medium">{formatStoryWordCount(Number(chapterWordCount), isZh ? "zh" : "en")}</dd></div>
          </dl>
          <button type="button" onClick={handleSubmit} disabled={!canCreate || busy} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium md:w-auto ${c.btnPrimary} disabled:cursor-not-allowed disabled:opacity-35`}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
            {busy ? (isZh ? "正在创建…" : "Creating…") : (isZh ? "创建故事" : "Create story")}
          </button>
        </div>
      </div>

      {kind === "long" ? (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>{isZh ? "书名" : "Title"}</span>
              <input value={longTitle} onChange={(event) => setLongTitle(event.target.value)} placeholder={isZh ? "例如：夜港账本" : "e.g. The Night Harbor Ledger"} className="w-full rounded-lg border border-border bg-secondary/20 px-3 py-2 outline-none focus:border-primary" />
            </label>
            <label className="space-y-2 text-sm">
              <span>{isZh ? "题材" : "Genre"}</span>
              <input value={longGenre} onChange={(event) => setLongGenre(event.target.value)} placeholder={isZh ? "例如：悬疑惊悚" : "e.g. Mystery thriller"} className="w-full rounded-lg border border-border bg-secondary/20 px-3 py-2 outline-none focus:border-primary" />
            </label>
          </div>
          <label className="block space-y-2 text-sm">
            <span className="flex items-center justify-between gap-3">
              <span>{isZh ? "故事方向" : "Story direction"}</span>
            </span>
            {directionGenerationError ? (
              <p className="text-xs leading-5 text-destructive">
                {isZh ? `自动生成失败，可手动编辑或重试：${directionGenerationError}` : `Generation failed; edit manually or retry: ${directionGenerationError}`}
              </p>
            ) : null}
            <textarea value={longDirection} onChange={(event) => setLongDirection(event.target.value)} rows={5} placeholder={isZh ? "简单写写故事发生在哪、主角是谁、要解决什么问题、想给读者什么感觉" : "Briefly describe the world, who the protagonist is, what problem they face, and the feeling you want readers to get"} className="w-full resize-y rounded-lg border border-border bg-secondary/20 px-3 py-2 leading-6 outline-none focus:border-primary" />
          </label>
        </div>
      ) : (
        <div className="min-h-[560px]">
          <StorySeedPreview
            streamedContent={shortSeedStreamedContent}
            status={shortSeedStatus}
            error={shortSeedError}
            isZh={isZh}
          />
        </div>
      )}

        </div>

      </div>
    </div>
  );
}
