import { Loader2, Sparkles } from "lucide-react";
import type { StorySeedGenerationStatus } from "./story-seed-stream";

interface StorySeedPreviewProps {
  readonly streamedContent: string;
  readonly status: StorySeedGenerationStatus;
  readonly error?: string | null;
  readonly isZh: boolean;
}

export type { StorySeedPreviewProps };

export function StorySeedPreview({
  streamedContent,
  status,
  error,
  isZh,
}: StorySeedPreviewProps) {
  const statusLabel = status === "generating"
    ? (isZh ? "正在生成完整故事设定" : "Generating the full story foundation")
    : status === "ready"
      ? (isZh ? "已生成，确认后创建" : "Generated — review before creating")
      : status === "error"
        ? (isZh ? "生成失败，可重新生成" : "Generation failed — try again")
        : (isZh ? "等待生成" : "Ready to generate");

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

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex min-h-[260px] flex-col gap-3">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
            {isZh ? "模型原始输出" : "Raw model output"}
          </div>
          <pre data-testid="story-seed-stream-output" className="min-h-[220px] whitespace-pre-wrap rounded-xl bg-secondary/20 p-4 font-mono text-xs leading-6 text-foreground/80">
            {streamedContent
              || (status === "generating" || status === "idle"
                ? (isZh ? "等待模型输出..." : "Waiting for model output...")
                : "")}
          </pre>
        </div>
      </div>
    </section>
  );
}
