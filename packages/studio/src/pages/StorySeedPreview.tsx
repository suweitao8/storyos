import type { StorySeed } from "@actalk/inkos-core";
import { Loader2, Sparkles } from "lucide-react";
import { STORY_SEED_SECTION_DEFINITIONS, type StorySeedGenerationStatus } from "./story-seed-stream";

interface StorySeedPreviewProps {
  readonly seed: StorySeed | null;
  readonly streamedContent: string;
  readonly status: StorySeedGenerationStatus;
  readonly error?: string | null;
  readonly isZh: boolean;
  readonly onChangeSeed: (seed: StorySeed) => void;
}

export type { StorySeedPreviewProps };

export function StorySeedPreview({
  seed,
  streamedContent,
  status,
  error,
  isZh,
  onChangeSeed,
}: StorySeedPreviewProps) {
  const statusLabel = status === "generating"
    ? (isZh ? "正在生成完整故事设定" : "Generating the full story foundation")
    : status === "ready"
      ? (isZh ? "已生成，可编辑后创建" : "Generated — edit before creating")
      : status === "error"
        ? (isZh ? "生成失败，可重新生成" : "Generation failed — try again")
        : (isZh ? "等待生成" : "Ready to generate");

  const updateField = (key: keyof StorySeed, value: string) => {
    if (!seed) return;
    onChangeSeed({ ...seed, [key]: value });
  };

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
        {seed ? (
          <div className="space-y-4">
            {STORY_SEED_SECTION_DEFINITIONS.map((definition) => {
              const label = isZh ? definition.zh : definition.en;
              const value = seed[definition.key];
              return (
                <label key={definition.key} className="block space-y-1.5 text-sm">
                  <span className="font-medium text-foreground/80">{label}</span>
                  {definition.key === "title" ? (
                    <input
                      aria-label={label}
                      value={value}
                      onChange={(event) => updateField(definition.key, event.target.value)}
                      className="w-full rounded-lg border border-border bg-secondary/20 px-3 py-2 font-medium outline-none focus:border-primary"
                    />
                  ) : (
                    <textarea
                      aria-label={label}
                      value={value}
                      onChange={(event) => updateField(definition.key, event.target.value)}
                      rows={definition.key === "outline" ? 5 : 3}
                      className="w-full resize-y rounded-lg border border-border bg-secondary/20 px-3 py-2 leading-6 outline-none focus:border-primary"
                    />
                  )}
                </label>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col gap-3">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
              {isZh ? "实时输出" : "Live output"}
            </div>
            <pre data-testid="story-seed-stream-output" className="min-h-[220px] whitespace-pre-wrap rounded-xl bg-secondary/20 p-4 font-mono text-xs leading-6 text-foreground/80">
              {streamedContent || (isZh ? "等待模型输出..." : "Waiting for model output...")}
            </pre>
          </div>
        )}

        {seed && streamedContent ? (
          <details className="mt-5 rounded-xl border border-border/40 bg-secondary/10">
            <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">
              {isZh ? "查看模型原始输出" : "View raw model output"}
            </summary>
            <pre data-testid="story-seed-stream-output" className="whitespace-pre-wrap border-t border-border/30 px-3 py-3 font-mono text-xs leading-6 text-muted-foreground">
              {streamedContent}
            </pre>
          </details>
        ) : null}
      </div>
    </section>
  );
}
