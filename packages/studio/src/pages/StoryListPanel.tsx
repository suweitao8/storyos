import { BookOpen, Feather, RotateCcw, ScrollText, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import type { CraftMode } from "@actalk/inkos-core/models/craft-profile";

import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { sortSoftDeletedLast } from "../api/soft-delete";

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
  readonly deletedAt?: string;
}

export interface StoryListItem {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly wordCountLabel: string;
  readonly active: boolean;
  readonly onSelect: () => void;
  readonly deleted: boolean;
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
  return sortSoftDeletedLast(records).map((record) => ({
    id: record.id,
    title: record.title ?? record.sourceName ?? record.id,
    summary: formatSummary(record),
    wordCountLabel: formatWordCount(record),
    active: record.id === activeId,
    deleted: Boolean(record.deletedAt),
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
  readonly onRestore?: (id: string) => void;
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
  onRestore,
}: StoryListPanelProps) {
  const [deleteTarget, setDeleteTarget] = useState<StoryListItem | null>(null);
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
                item.deleted
                  ? "border-border/50 bg-secondary/30 text-muted-foreground opacity-65"
                  : item.active
                  ? "border-primary/50 bg-primary/5 shadow-sm"
                  : "border-border/70 bg-card/40 hover:bg-secondary/20",
              )}
            >
              <button
                type="button"
                aria-current={item.active ? "page" : undefined}
                disabled={item.deleted}
                onClick={item.onSelect}
                className={cn("flex min-w-0 w-full flex-col items-start gap-3 pr-7 text-left", item.deleted ? "cursor-not-allowed" : "")}
              >
                <span className={cn("shrink-0", item.active ? "text-primary" : "text-muted-foreground/60")}>
                  {kindIcon(kind)}
                </span>
                <span className="min-w-0 w-full">
                  <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                  <span className="mt-2 block line-clamp-3 text-xs leading-5 text-muted-foreground">{item.summary}</span>
                </span>
                <span className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px]",
                  item.deleted
                    ? "border-border/60 bg-secondary/50 text-muted-foreground"
                    : "border-primary/20 bg-primary/[0.06] text-primary",
                )}>
                  {item.deleted ? (isZh ? "垃圾桶 · 72 小时后自动清理" : "Trash · auto-clears after 72 hours") : item.wordCountLabel}
                </span>
              </button>
              {item.deleted && onRestore ? (
                <button
                  type="button"
                  aria-label={isZh ? "恢复故事" : "Restore story"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRestore(item.id);
                  }}
                  className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-primary"
                >
                  <RotateCcw size={14} />
                </button>
              ) : onDelete && !item.deleted ? (
                <button
                  type="button"
                  aria-label={isZh ? "删除故事" : "Delete story"}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTarget(item);
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
      <ConfirmDialog
        open={deleteTarget !== null}
        title={isZh ? "移入垃圾桶" : "Move to trash"}
        message={isZh
          ? `确认将“${deleteTarget?.title ?? ""}”移入垃圾桶吗？72 小时后会自动删除。`
          : `Move “${deleteTarget?.title ?? ""}” to trash? It will be deleted automatically after 72 hours.`}
        confirmLabel={isZh ? "移入垃圾桶" : "Move to trash"}
        cancelLabel={isZh ? "取消" : "Cancel"}
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) onDelete?.(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
