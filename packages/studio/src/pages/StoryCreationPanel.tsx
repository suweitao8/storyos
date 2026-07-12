import { useEffect, useState } from "react";
import { ArrowUp, Loader2, Wand2 } from "lucide-react";
import type { Theme } from "../hooks/use-theme";
import { useColors } from "../hooks/use-colors";
import type { CraftOption } from "./story-creation-state";
import {
  buildDefaultStoryDirection,
  buildStoryWordCountOptions,
  resolveDefaultStoryWordCount,
  type LongStoryCreationInput,
  type ShortStoryCreationInput,
} from "./story-creation-state";

export type { CraftOption } from "./story-creation-state";

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
  onOpenCraft,
}: StoryCreationPanelProps) {
  const c = useColors(theme);
  const [longTitle, setLongTitle] = useState("");
  const [longGenre, setLongGenre] = useState("");
  const [longDirection, setLongDirection] = useState("");
  const [chapterWordCount, setChapterWordCount] = useState("10000");
  const [shortDirection, setShortDirection] = useState("");

  const selectedCraft = crafts.find((craft) => craft.id === selectedCraftId);
  const hasCraftSelection = Boolean(selectedCraftId && selectedCraft);

  useEffect(() => {
    if (!selectedCraft) return;
    const defaultDirection = buildDefaultStoryDirection(selectedCraft, kind, isZh);
    if (kind === "long") {
      setLongDirection((current) => current.trim() ? current : defaultDirection);
    } else {
      setShortDirection((current) => current.trim() ? current : defaultDirection);
    }
  }, [isZh, kind, selectedCraft]);

  useEffect(() => {
    setChapterWordCount(String(resolveDefaultStoryWordCount(selectedCraft?.recommendedWordCount)));
  }, [selectedCraftId, selectedCraft?.recommendedWordCount]);

  const wordCountOptions = buildStoryWordCountOptions(selectedCraft?.recommendedWordCount);
  const canCreate = Boolean(
    activeSessionId
      && (kind === "long"
        ? longTitle.trim() && longGenre.trim() && longDirection.trim()
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
      direction: shortDirection,
      chapterWordCount: Number(chapterWordCount),
      ...(hasCraftSelection ? { craftId: selectedCraftId } : {}),
    });
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-5 overflow-y-auto px-4 py-6 md:px-6">
      <div className="rounded-2xl border border-border/60 bg-secondary/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{isZh ? "用写作模式创建故事" : "Create with writing craft"}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {isZh ? "先生成基础故事，再切换到“对话调整”继续修改。" : "Create the story foundation first, then refine it in chat."}
            </p>
          </div>
          <Wand2 size={22} className="shrink-0 text-primary" />
        </div>

        <div className="mt-5 space-y-2">
          <label htmlFor="story-craft-select" className="text-sm font-medium">
            {isZh ? "写作模式" : "Writing mode"}
          </label>
          <select
            id="story-craft-select"
            aria-label={isZh ? "写作模式" : "Writing mode"}
            value={selectedCraftId}
            onChange={(event) => onCraftChange(event.target.value)}
            disabled={busy || craftsLoading}
            className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50"
          >
            <option value="">{isZh ? "不使用写作模式" : "No writing mode"}</option>
            {crafts.map((craft) => (
              <option key={craft.id} value={craft.id}>
                {craft.sourceName}{craft.mode === "ghost-story" ? (isZh ? " · 鬼故事" : " · Ghost story") : ""}
              </option>
            ))}
          </select>
          {craftsLoading ? <p className="text-xs text-muted-foreground">{isZh ? "正在加载写作模式…" : "Loading writing modes…"}</p> : null}
          {craftsError ? <p className="text-xs text-destructive">{isZh ? `加载失败：${craftsError}` : `Failed to load: ${craftsError}`}</p> : null}
          {selectedCraft ? (
            <p className="text-xs leading-5 text-primary">
              {isZh ? `当前使用：${selectedCraft.sourceName}${selectedCraft.mode === "ghost-story" ? "（鬼故事模式）" : ""}` : `Using: ${selectedCraft.sourceName}`}
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
      </div>

      {kind === "long" ? (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-5">
          <div className="text-sm font-semibold">{isZh ? "长篇故事基础信息" : "Long-story basics"}</div>
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
            <span>{isZh ? "故事方向" : "Story direction"}</span>
            <textarea value={longDirection} onChange={(event) => setLongDirection(event.target.value)} rows={5} placeholder={isZh ? "写清楚世界、主角压力、核心冲突和你想要的情绪回报" : "Describe the world, protagonist pressure, core conflict, and payoff"} className="w-full resize-y rounded-lg border border-border bg-secondary/20 px-3 py-2 leading-6 outline-none focus:border-primary" />
          </label>
          <div className="grid gap-4">
            <label className="space-y-2 text-sm">
              <span>{isZh ? "每章字数" : "Words / chapter"}</span>
              <select value={chapterWordCount} onChange={(event) => setChapterWordCount(event.target.value)} className="w-full rounded-lg border border-border bg-secondary/20 px-3 py-2 outline-none focus:border-primary">
                {wordCountOptions.map((count) => <option key={count} value={count}>{count.toLocaleString()} {isZh ? "字" : "words"}{count === selectedCraft?.recommendedWordCount ? (isZh ? "（模式建议）" : " (mode recommendation)") : ""}</option>)}
              </select>
              {selectedCraft?.recommendedWordCount ? (
                <p className="text-xs leading-5 text-primary">
                  {isZh
                    ? `已按当前模式默认：约 ${selectedCraft.recommendedWordCount.toLocaleString()} 字`
                    : `Defaulted from this mode: about ${selectedCraft.recommendedWordCount.toLocaleString()} words`}
                </p>
              ) : null}
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-5">
          <div className="text-sm font-semibold">{isZh ? "短篇故事基础信息" : "Short-story basics"}</div>
          <label className="block space-y-2 text-sm">
            <span>{isZh ? "故事方向" : "Story direction"}</span>
            <textarea value={shortDirection} onChange={(event) => setShortDirection(event.target.value)} rows={6} placeholder={isZh ? "例如：一名守夜人接到来自已故邻居的电话，逐步发现小区的门牌会改变记忆" : "e.g. A night watchman receives a call from a dead neighbor"} className="w-full resize-y rounded-lg border border-border bg-secondary/20 px-3 py-2 leading-6 outline-none focus:border-primary" />
          </label>
          <div className="grid gap-4">
            <label className="space-y-2 text-sm">
              <span>{isZh ? "每章字数" : "Words / chapter"}</span>
              <select value={chapterWordCount} onChange={(event) => setChapterWordCount(event.target.value)} className="w-full rounded-lg border border-border bg-secondary/20 px-3 py-2 outline-none focus:border-primary">
                {wordCountOptions.map((count) => <option key={count} value={count}>{count.toLocaleString()} {isZh ? "字" : "words"}{count === selectedCraft?.recommendedWordCount ? (isZh ? "（模式建议）" : " (mode recommendation)") : ""}</option>)}
              </select>
              {selectedCraft?.recommendedWordCount ? (
                <p className="text-xs leading-5 text-primary">
                  {isZh
                    ? `已按当前模式默认：约 ${selectedCraft.recommendedWordCount.toLocaleString()} 字`
                    : `Defaulted from this mode: about ${selectedCraft.recommendedWordCount.toLocaleString()} words`}
                </p>
              ) : null}
            </label>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canCreate || busy}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${c.btnPrimary} disabled:cursor-not-allowed disabled:opacity-35`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
        {busy ? (isZh ? "正在创建…" : "Creating…") : (isZh ? "创建故事基础" : "Create story foundation")}
      </button>
      <p className="pb-4 text-center text-xs leading-5 text-muted-foreground">
        {isZh ? "创建完成后会自动切换到“对话调整”，你可以继续修改故事。封面不会在这里生成。" : "After creation, the view switches to chat refinement. Covers are not generated here."}
      </p>
    </div>
  );
}
