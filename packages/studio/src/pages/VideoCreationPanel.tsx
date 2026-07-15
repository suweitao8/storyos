import { useEffect, useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";
import type { Theme } from "../hooks/use-theme";
import type { CraftOption } from "./story-creation-state";
import {
  buildVideoCreationAction,
  requiredCraftModeForVideoCreation,
  type VideoCreationInput,
  type VideoCreationType,
} from "./video-creation-state";

interface VideoCreationPanelProps {
  readonly type: VideoCreationType;
  readonly theme: Theme;
  readonly isZh: boolean;
  readonly activeSessionId: string | null;
  readonly busy: boolean;
  readonly crafts: ReadonlyArray<CraftOption>;
  readonly craftsLoading: boolean;
  readonly craftsError?: string | null;
  readonly selectedCraftId: string;
  readonly onCraftChange: (craftId: string) => void;
  readonly onCreate: (input: VideoCreationInput) => Promise<void>;
  readonly onOpenCraft?: () => void;
}

const COPY = {
  "film-commentary": {
    zh: { title: "影视解说", subtitle: "使用影视拆解中的影视解说模式，制作旁白驱动的视频脚本。" },
    en: { title: "Film Commentary", subtitle: "Create a narration-led video script from the film-commentary craft." },
  },
  "review-commentary": {
    zh: { title: "评论调侃", subtitle: "使用评论调侃模式，制作观点清楚、节奏轻快的视频脚本。" },
    en: { title: "Review & Commentary", subtitle: "Create a clear, fast-paced video script from the review craft." },
  },
} as const;

export function VideoCreationPanel({
  type,
  theme: _theme,
  isZh,
  activeSessionId,
  busy,
  crafts,
  craftsLoading,
  craftsError,
  selectedCraftId,
  onCraftChange,
  onCreate,
  onOpenCraft,
}: VideoCreationPanelProps) {
  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState("");
  const [episodeDuration, setEpisodeDuration] = useState("3分钟");
  const copy = COPY[type][isZh ? "zh" : "en"];
  const requiredMode = requiredCraftModeForVideoCreation(type);
  const selectedCraft = crafts.find((craft) => craft.id === selectedCraftId);
  const canCreate = Boolean(activeSessionId && title.trim() && direction.trim() && episodeDuration.trim() && selectedCraft);

  useEffect(() => {
    if (selectedCraft && selectedCraft.mode !== requiredMode) onCraftChange("");
  }, [onCraftChange, requiredMode, selectedCraft]);

  const submit = () => {
    if (!canCreate || busy) return;
    void onCreate({ type, title, direction, craftId: selectedCraftId, episodeDuration, language: isZh ? "zh" : "en" });
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-[960px] flex-col justify-center px-6 py-10">
      <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Clapperboard size={24} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{copy.title}</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">{isZh ? "视频标题" : "Video title"}</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={isZh ? "例如：三分钟看懂某部电影" : "e.g. A three-minute film breakdown"} className="w-full rounded-xl border border-border bg-secondary/20 px-3 py-2.5 outline-none focus:border-primary" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{isZh ? "视频时长" : "Video duration"}</span>
            <input value={episodeDuration} onChange={(event) => setEpisodeDuration(event.target.value)} placeholder={isZh ? "例如：3分钟" : "e.g. 3 minutes"} className="w-full rounded-xl border border-border bg-secondary/20 px-3 py-2.5 outline-none focus:border-primary" />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">{isZh ? "创作方向" : "Creative direction"}</span>
            <textarea value={direction} onChange={(event) => setDirection(event.target.value)} rows={5} placeholder={isZh ? "写清楚想讲什么、重点看什么、希望观众得到什么。" : "Explain what to cover and what viewers should take away."} className="w-full resize-y rounded-xl border border-border bg-secondary/20 px-3 py-2.5 leading-6 outline-none focus:border-primary" />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">{isZh ? "对应写作模式" : "Matching writing mode"}</span>
            <select value={selectedCraftId} onChange={(event) => onCraftChange(event.target.value)} disabled={busy || (craftsLoading && crafts.length === 0)} className="w-full rounded-xl border border-border bg-secondary/20 px-3 py-2.5 outline-none focus:border-primary disabled:opacity-50">
              <option value="">{isZh ? `请选择${copy.title}写作模式` : `Select a ${copy.title} craft`}</option>
              {crafts.filter((craft) => craft.mode === requiredMode && craft.sourceType === "bilibili").map((craft) => <option key={craft.id} value={craft.id}>{craft.sourceName}</option>)}
            </select>
            {craftsLoading ? <p className="text-xs text-muted-foreground">{isZh ? "正在加载写作模式…" : "Loading writing modes…"}</p> : null}
            {craftsError ? <p className="text-xs text-destructive">{isZh ? `加载失败：${craftsError}` : `Failed to load: ${craftsError}`}</p> : null}
            {!craftsLoading && crafts.length === 0 ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {isZh ? `暂无${copy.title}写作模式，请先在「写作模式」中创建。` : `No ${copy.title} craft is available. Create one in Writing Modes first.`}
                {onOpenCraft ? <button type="button" onClick={onOpenCraft} className="ml-2 text-primary hover:underline">{isZh ? "去创建" : "Create one"}</button> : null}
              </p>
            ) : null}
          </label>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground">{isZh ? "只允许使用对应类型的写作模式" : "Only the matching craft mode is allowed"}</span>
          <button type="button" onClick={submit} disabled={!canCreate || busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            {isZh ? "创建视频脚本" : "Create video script"}
          </button>
        </div>
      </div>
    </div>
  );
}
