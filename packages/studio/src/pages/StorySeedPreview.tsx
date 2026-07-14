import { Loader2, Sparkles } from "lucide-react";
import type { StorySeedGenerationStatus } from "./story-seed-stream";

interface StorySeedPreviewProps {
  readonly streamedContent: string;
  readonly status: StorySeedGenerationStatus;
  readonly error?: string | null;
  readonly isZh: boolean;
  readonly score?: number;
  readonly scoreNote?: string;
}

export type { StorySeedPreviewProps };

export function StorySeedPreview({
  streamedContent,
  status,
  error,
  isZh,
  score,
  scoreNote,
}: StorySeedPreviewProps) {
  const statusLabel = status === "generating"
    ? (isZh ? "正在生成完整故事设定" : "Generating the full story foundation")
    : status === "ready"
      ? (isZh ? "已生成，确认后创建" : "Generated — review before creating")
      : status === "error"
        ? (isZh ? "生成失败，可重新生成" : "Generation failed — try again")
        : (isZh ? "等待后台任务启动" : "Waiting for background job");

  const hasScore = typeof score === "number" && score > 0;
  const scoreColor = !hasScore ? "" : score >= 75 ? "text-emerald-500" : score >= 60 ? "text-amber-500" : "text-destructive";
  const lowScore = hasScore && score < 60;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/70">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles size={17} className="text-primary" />
          <h3 className="text-sm font-semibold">{isZh ? "故事设定预览" : "Story foundation preview"}</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {status === "generating" ? <Loader2 size={13} className="animate-spin text-primary" /> : null}
          <span>{statusLabel}</span>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mx-5 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
          {error}
        </div>
      ) : null}

      {/* AI score badge */}
      {status === "ready" && (
        <div className="mx-5 mt-4 flex flex-wrap items-center gap-3">
          {hasScore ? (
            <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${lowScore ? "border-destructive/30 bg-destructive/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
              <span className={`text-lg font-bold ${scoreColor}`}>{score}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              {isZh ? "正在评分…" : "Scoring…"}
            </div>
          )}
          {scoreNote && (
            <span className={`text-xs ${lowScore ? "text-destructive" : "text-muted-foreground"}`}>{scoreNote}</span>
          )}
          {lowScore && (
            <span className="text-xs font-medium text-destructive">
              {isZh ? "分数偏低，建议重新生成" : "Low score — consider regenerating"}
            </span>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex min-h-[260px] flex-col gap-3">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
            {isZh ? "模型原始输出" : "Raw model output"}
          </div>
          <pre data-testid="story-seed-stream-output" className="min-h-[220px] whitespace-pre-wrap rounded-xl bg-secondary/20 p-4 font-mono text-xs leading-6 text-foreground/80">
            {streamedContent
              || (status === "generating"
                ? (isZh ? "模型正在后台生成故事设定。你可以离开此页面，完成后回来查看结果。" : "The model is generating this foundation in the background. You can leave this page and return when it is ready.")
                : status === "idle"
                  ? (isZh ? "还没有默认故事设定。你可以点击'重新随机生成'，也可以直接使用默认规则创作。" : "No default story foundation exists yet. Regenerate one, or create directly with the default rules.")
                  : "")}
          </pre>
        </div>
      </div>
    </section>
  );
}
