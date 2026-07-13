import { BookOpen, Feather, ScrollText, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { CraftMode } from "@actalk/inkos-core/models/craft-profile";

import { cn } from "@/lib/utils";

export type StoryListKind = "book" | "short" | "craft";

export interface StoryListRecord {
  readonly id: string;
  readonly title?: string;
  readonly sourceName?: string;
  readonly summary?: string;
  readonly genre?: string;
  readonly status?: string;
  readonly mode?: CraftMode;
  readonly chaptersWritten?: number;
  readonly wordCount?: number;
  readonly recommendedWordCount?: number;
}

export interface StoryListItem {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly wordCountLabel: string;
  readonly active: boolean;
  readonly onSelect: () => void;
}

export type StoryListStatus = "loading" | "error" | "empty" | "ready";

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function formatSummary(record: StoryListRecord): string {
  const summary = record.summary?.trim();
  return summary || "暂无故事概述";
}

function formatWordCount(record: StoryListRecord): string {
  const count = record.wordCount ?? record.recommendedWordCount ?? 0;
  return `${formatCount(Math.max(0, count))} 字`;
}

export function buildStoryListItems(
  _kind: StoryListKind,
  records: ReadonlyArray<StoryListRecord>,
  activeId: string | null | undefined,
  onSelect: (id: string) => void,
): ReadonlyArray<StoryListItem> {
  return records.map((record) => ({
    id: record.id,
    title: record.title ?? record.sourceName ?? record.id,
    summary: formatSummary(record),
    wordCountLabel: formatWordCount(record),
    active: record.id === activeId,
    onSelect: () => onSelect(record.id),
  }));
}

export function resolveStoryListStatus(input: {
  readonly loading: boolean;
  readonly error: string | null;
  readonly records: ReadonlyArray<StoryListRecord>;
}): StoryListStatus {
  if (input.loading) return "loading";
  if (input.error) return "error";
  return input.records.length > 0 ? "ready" : "empty";
}

function kindIcon(kind: StoryListKind): ReactNode {
  if (kind === "short") return <ScrollText size={18} />;
  if (kind === "craft") return <Feather size={18} />;
  return <BookOpen size={18} />;
}

export interface StoryListPanelProps {
  readonly kind: StoryListKind;
  readonly records: ReadonlyArray<StoryListRecord>;
  readonly activeId?: string | null;
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly isZh: boolean;
  readonly onSelect: (id: string) => void;
  readonly onDelete?: (id: string) => void;
}

export function StoryListPanel({
  kind,
  records,
  activeId,
  loading = false,
  error = null,
  isZh,
  onSelect,
  onDelete,
}: StoryListPanelProps) {
  const status = resolveStoryListStatus({ loading, error, records });
  const items = buildStoryListItems(kind, records, activeId, onSelect);

  return (
    <section className="flex h-full min-w-0 flex-col px-6 py-6 md:px-10">
      {status === "loading" && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {isZh ? "正在加载列表..." : "Loading list..."}
        </div>
      )}
      {status === "error" && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {status === "empty" && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {isZh ? "还没有可选择的内容。" : "There is nothing to select yet."}
        </div>
      )}
      {status === "ready" && (
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "relative min-h-40 rounded-2xl border p-5 transition-colors",
                item.active
                  ? "border-primary/50 bg-primary/5 shadow-sm"
                  : "border-border/70 bg-card/40 hover:bg-secondary/20",
              )}
            >
              <button
                type="button"
                aria-current={item.active ? "page" : undefined}
                onClick={item.onSelect}
                className="flex min-w-0 w-full flex-col items-start gap-3 pr-7 text-left"
              >
                <span className={cn("shrink-0", item.active ? "text-primary" : "text-muted-foreground/60")}>
                  {kindIcon(kind)}
                </span>
                <span className="min-w-0 w-full">
                  <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                  <span className="mt-2 block line-clamp-3 text-xs leading-5 text-muted-foreground">{item.summary}</span>
                </span>
                <span className="rounded-full border border-primary/20 bg-primary/[0.06] px-2 py-0.5 text-[11px] text-primary">
                  {item.wordCountLabel}
                </span>
              </button>
              {onDelete ? (
                <button
                  type="button"
                  aria-label={isZh ? "删除故事" : "Delete story"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(item.id);
                  }}
                  className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
