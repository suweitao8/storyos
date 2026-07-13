import { BookOpen, Feather, ScrollText } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StoryListKind = "book" | "short" | "craft";

export interface StoryListRecord {
  readonly id: string;
  readonly title?: string;
  readonly sourceName?: string;
  readonly genre?: string;
  readonly status?: string;
  readonly mode?: "general" | "ghost-story";
  readonly chaptersWritten?: number;
  readonly wordCount?: number;
}

export interface StoryListItem {
  readonly id: string;
  readonly title: string;
  readonly meta: string;
  readonly active: boolean;
  readonly onSelect: () => void;
}

export type StoryListStatus = "loading" | "error" | "empty" | "ready";

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function formatMeta(kind: StoryListKind, record: StoryListRecord): string {
  if (kind === "craft") {
    return record.mode === "ghost-story" ? "鬼故事" : "通用";
  }
  if (kind === "short") {
    return `${formatCount(record.wordCount ?? 0)} 字`;
  }
  return `${record.chaptersWritten ?? 0} 章`;
}

export function buildStoryListItems(
  kind: StoryListKind,
  records: ReadonlyArray<StoryListRecord>,
  activeId: string | null | undefined,
  onSelect: (id: string) => void,
): ReadonlyArray<StoryListItem> {
  return records.map((record) => ({
    id: record.id,
    title: record.title ?? record.sourceName ?? record.id,
    meta: formatMeta(kind, record),
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
}

export function StoryListPanel({
  kind,
  records,
  activeId,
  loading = false,
  error = null,
  isZh,
  onSelect,
}: StoryListPanelProps) {
  const status = resolveStoryListStatus({ loading, error, records });
  const items = buildStoryListItems(kind, records, activeId, onSelect);
  const title = kind === "book"
    ? (isZh ? "长篇故事" : "Long stories")
    : kind === "short"
      ? (isZh ? "短篇故事" : "Short stories")
      : (isZh ? "写作模式" : "Writing modes");

  return (
    <section className="flex h-full min-w-0 flex-col px-6 py-6 md:px-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {isZh ? "选择内容" : "Select content"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
        {status === "ready" && (
          <span className="text-xs text-muted-foreground">
            {isZh ? `${items.length} 项` : `${items.length} items`}
          </span>
        )}
      </div>

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
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.active ? "page" : undefined}
              onClick={item.onSelect}
              className={cn(
                "flex min-w-0 items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                item.active
                  ? "border-primary/60 bg-primary/8 text-foreground shadow-sm"
                  : "border-border/70 bg-card/40 text-muted-foreground hover:border-primary/35 hover:bg-secondary/35 hover:text-foreground",
              )}
            >
              <span className={cn("mt-0.5 shrink-0", item.active ? "text-primary" : "text-muted-foreground/60")}>
                {kindIcon(kind)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.meta}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
