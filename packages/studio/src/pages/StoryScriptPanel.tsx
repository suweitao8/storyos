import { useState } from "react";
import { Clapperboard, RefreshCw, Sparkles } from "lucide-react";

import { postApi, useApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { UnifiedScriptDocument } from "../api/story-production";

interface ProductionResponse {
  readonly script: UnifiedScriptDocument & { readonly exists: boolean; readonly content: string; readonly generatedAt?: string | null };
  readonly video: { readonly exists: boolean; readonly durationMs?: number | null; readonly voiceEnabled?: boolean; readonly warning?: string | null };
  readonly warning?: string | null;
}

export function hasStoryProductionContent(value: { readonly script?: { readonly exists?: boolean } } | null | undefined): boolean {
  return value?.script?.exists === true;
}

export function buildStoryProductionPath(kind: "book" | "short", storyId: string): string {
  return `/${kind === "short" ? "shorts" : "books"}/${encodeURIComponent(storyId)}/production`;
}

interface StoryScriptPanelProps {
  readonly kind: "book" | "short";
  readonly storyId: string | null;
  readonly theme: Theme;
  readonly isZh: boolean;
}

export function StoryScriptPanel({ kind, storyId, theme: _theme, isZh }: StoryScriptPanelProps) {
  const path = storyId ? buildStoryProductionPath(kind, storyId) : "";
  const { data, loading, error, refetch } = useApi<ProductionResponse>(path);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!loading && (!storyId || data && !hasStoryProductionContent(data))) {
    return (
      <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card/20" data-testid="story-script-panel">
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <EmptyState text={isZh ? "暂无内容" : "No content"} />
        </div>
      </section>
    );
  }

  const generate = async () => {
    if (!storyId) return;
    setBusy(true);
    setActionError(null);
    try {
      await postApi(`${path}/script`);
      await refetch();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card/20" data-testid="story-script-panel">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border/40 px-6 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <Clapperboard size={21} className="shrink-0 text-primary" />
          <div className="min-w-0" />
        </div>
        <button type="button" onClick={() => void generate()} disabled={!storyId || busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {busy ? (isZh ? "生成中..." : "Generating...") : data?.script.exists ? (isZh ? "重新生成剧本" : "Regenerate script") : (isZh ? "生成剧本" : "Generate script")}
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {loading && !data ? <EmptyState text={isZh ? "正在加载剧本..." : "Loading script..."} /> : error ? <ErrorState text={error} /> : !data?.script.exists ? <EmptyState text={isZh ? "暂无内容" : "No content"} /> : (
          <div className="space-y-6">
            {actionError || data.warning ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">{actionError ?? data.warning}</div> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <MetaCard label={isZh ? "镜头数" : "Shots"} value={String(data.script.shots.length)} />
              <MetaCard label={isZh ? "视频状态" : "Video"} value={data.video.exists ? (isZh ? "已生成" : "Ready") : (isZh ? "待生成" : "Not generated")} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {data.script.shots.map((shot) => (
                <article key={`${shot.number}-${shot.scene}`} className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{shot.scene}</p>
                      <h2 className="mt-1 text-base font-semibold">{isZh ? `镜头 ${shot.number}` : `Shot ${shot.number}`}</h2>
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">{shot.durationMs ? `${Math.round(shot.durationMs / 1000)}s` : (isZh ? "自动时长" : "Auto")}</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-foreground/80">{shot.visual}</p>
                  {shot.action ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{isZh ? "动作：" : "Action: "}{shot.action}</p> : null}
                  <div className="mt-4 rounded-xl bg-secondary/50 px-3 py-2 text-sm leading-6">{shot.subtitle || (isZh ? "无字幕/台词" : "No subtitle or dialogue")}</div>
                  {shot.imagePrompt ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{isZh ? "图像提示词：" : "Image prompt: "}{shot.imagePrompt}</p> : null}
                </article>
              ))}
            </div>
            <details className="rounded-xl border border-border/50 bg-background/60 p-4">
              <summary className="cursor-pointer text-sm font-medium">{isZh ? "查看完整剧本 Markdown" : "View full script Markdown"}</summary>
              <pre className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/80">{data.script.content}</pre>
            </details>
          </div>
        )}
      </div>
    </section>
  );
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
