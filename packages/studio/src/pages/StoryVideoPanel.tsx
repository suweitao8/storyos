import { useState } from "react";
import { Film, RefreshCw, Volume2, VolumeX } from "lucide-react";

import { postApi, useApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { UnifiedScriptDocument } from "../api/story-production";
import { buildStoryProductionPath } from "./StoryScriptPanel";

interface ProductionResponse {
  readonly script: UnifiedScriptDocument & { readonly exists: boolean; readonly content: string };
  readonly video: { readonly exists: boolean; readonly durationMs?: number | null; readonly voiceEnabled?: boolean; readonly warning?: string | null; readonly generatedAt?: string | null };
  readonly warning?: string | null;
}

interface StoryVideoPanelProps {
  readonly kind: "book" | "short";
  readonly storyId: string | null;
  readonly theme: Theme;
  readonly isZh: boolean;
}

export function StoryVideoPanel({ kind, storyId, theme: _theme, isZh }: StoryVideoPanelProps) {
  const path = storyId ? buildStoryProductionPath(kind, storyId) : "";
  const { data, loading, error, refetch } = useApi<ProductionResponse>(path);
  const [withVoice, setWithVoice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const videoUrl = storyId ? `${path}/video/file?ts=${encodeURIComponent(data?.video.generatedAt ?? "0")}` : "";

  const generate = async () => {
    if (!storyId) return;
    setBusy(true);
    setActionError(null);
    try {
      await postApi(`${path}/video`, { voice: withVoice });
      await refetch();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card/20" data-testid="story-video-panel">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border/40 px-6 py-5">
        <div className="flex min-w-0 items-center gap-3"><Film size={21} className="shrink-0 text-primary" /><div><h1 className="text-2xl font-semibold">{isZh ? "视频" : "Video"}</h1><p className="mt-1 text-sm text-muted-foreground">{isZh ? "使用剧本中的镜头、字幕和语音合成基础视频。" : "Compose a first video from the script shots, subtitles, and voice."}</p></div></div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={withVoice} onChange={(event) => setWithVoice(event.target.checked)} />{withVoice ? <Volume2 size={15} /> : <VolumeX size={15} />}{isZh ? "合成语音" : "Synthesize voice"}</label>
          <button type="button" onClick={() => void generate()} disabled={!storyId || !data?.script.exists || busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{busy ? <RefreshCw size={16} className="animate-spin" /> : <Film size={16} />}{busy ? (isZh ? "合成中..." : "Composing...") : data?.video.exists ? (isZh ? "重新生成视频" : "Regenerate video") : (isZh ? "生成视频" : "Generate video")}</button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {!storyId ? <EmptyState text={isZh ? "选择故事后才能制作视频。" : "Select a story before making a video."} /> : loading && !data ? <EmptyState text={isZh ? "正在加载视频状态..." : "Loading video status..."} /> : error ? <ErrorState text={error} /> : !data?.script.exists ? <EmptyState text={isZh ? "请先进入剧本阶段生成剧本。" : "Generate the script first."} /> : (
          <div className="mx-auto w-full max-w-5xl space-y-5">
            {actionError || data.warning || data.video.warning ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">{actionError ?? data.warning ?? data.video.warning}</div> : null}
            {data.video.exists ? <video key={videoUrl} className="aspect-video w-full rounded-2xl border border-border/50 bg-black shadow-lg" src={videoUrl} controls preload="metadata" /> : <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-border bg-background/50 text-sm text-muted-foreground">{isZh ? "还没有视频，点击右上角生成基础版本。" : "No video yet. Generate a first version above."}</div>}
            <div className="grid gap-3 sm:grid-cols-3"><MetaCard label={isZh ? "剧本镜头" : "Script shots"} value={String(data.script.shots.length)} /><MetaCard label={isZh ? "视频时长" : "Duration"} value={formatDuration(data.video.durationMs)} /><MetaCard label={isZh ? "音频" : "Audio"} value={data.video.voiceEnabled ? (isZh ? "已合成" : "Generated") : (isZh ? "字幕视频" : "Subtitles only")} /></div>
            <p className="text-sm leading-6 text-muted-foreground">{isZh ? "这是今天可直接验证的基础版本：画面先使用统一底色和字幕，后续可把每个镜头的图像提示词替换成故事资产参考图。" : "This is the first verifiable version: a simple background and subtitles are used first, and shot image prompts can later be replaced with story asset references."}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function formatDuration(value?: number | null): string {
  if (!value || value <= 0) return "--";
  const seconds = Math.round(value / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function MetaCard({ label, value }: { readonly label: string; readonly value: string }) {
  return <div className="rounded-xl border border-border/50 bg-background/60 px-4 py-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value}</div></div>;
}

function EmptyState({ text }: { readonly text: string }) {
  return <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function ErrorState({ text }: { readonly text: string }) {
  return <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{text}</div>;
}
