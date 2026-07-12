import { useEffect } from "react";
import { BookOpen, RefreshCw } from "lucide-react";
import type { Theme } from "../../hooks/use-theme";
import { useApi } from "../../hooks/use-api";

interface StorySection {
  readonly file: string;
  readonly title: string;
  readonly content: string;
}

interface StoryChapter {
  readonly number: number;
  readonly title: string;
  readonly status: string;
  readonly wordCount: number;
  readonly content: string;
}

interface StoryContentResponse {
  readonly book: {
    readonly title: string;
    readonly genre: string;
    readonly targetChapters?: number;
    readonly chapterWordCount: number;
  };
  readonly sections: ReadonlyArray<StorySection>;
  readonly chapters: ReadonlyArray<StoryChapter>;
}

function trimHeading(content: string): string {
  return content.replace(/^\uFEFF?\s*#\s+[^\n]+\n?/, "").trim();
}

export function StoryContentPanel({
  bookId,
  storyId,
  theme: _theme,
  isZh,
  refreshToken,
}: {
  readonly bookId: string | null;
  readonly storyId: string | null;
  readonly theme: Theme;
  readonly isZh: boolean;
  readonly refreshToken: number;
}) {
  const { data, loading, error, refetch } = useApi<StoryContentResponse>(
    storyId
      ? `/shorts/${encodeURIComponent(storyId)}/content`
      : bookId
        ? `/books/${encodeURIComponent(bookId)}/content`
        : "",
  );

  useEffect(() => {
    if (refreshToken > 0) void refetch();
  }, [refreshToken, refetch]);

  const hasContent = Boolean(data && (data.sections.length > 0 || data.chapters.length > 0));
  const sections = data?.sections ?? [];
  const chapters = data?.chapters ?? [];

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-card/20">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <BookOpen size={17} className="shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-foreground">
              {data?.book.title ?? (isZh ? "故事内容" : "Story Content")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isZh ? "基础设定与已生成章节" : "Foundation and generated chapters"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={loading || (!bookId && !storyId)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
          title={isZh ? "刷新故事内容" : "Refresh story content"}
          aria-label={isZh ? "刷新故事内容" : "Refresh story content"}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {!bookId && !storyId ? (
          <div className="flex h-full min-h-48 items-center justify-center text-center text-sm leading-6 text-muted-foreground">
            {isZh ? "创建完成后，故事内容会显示在这里。" : "Story content will appear here after creation."}
          </div>
        ) : loading && !data ? (
          <div className="flex h-full min-h-48 items-center justify-center text-sm text-muted-foreground">
            {isZh ? "正在加载故事内容..." : "Loading story content..."}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6 text-destructive">
            {error}
          </div>
        ) : !hasContent ? (
          <div className="flex h-full min-h-48 items-center justify-center text-center text-sm leading-6 text-muted-foreground">
            {isZh ? "基础故事正在写入，请稍后刷新。" : "The foundation is still being written. Refresh in a moment."}
          </div>
        ) : (
          <div className="space-y-7">
            {sections.map((section) => (
              <article key={section.file} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">{section.title}</h3>
                  <span className="truncate text-[10px] text-muted-foreground/60">{section.file}</span>
                </div>
                <div className="whitespace-pre-wrap break-words rounded-xl border border-border/40 bg-background/35 px-4 py-3 text-[13px] leading-7 text-foreground/85">
                  {trimHeading(section.content)}
                </div>
              </article>
            ))}

            {chapters.map((chapter) => (
              <article key={`chapter-${chapter.number}`} className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-bold text-foreground">
                    {isZh ? `第 ${chapter.number} 章 ${chapter.title}` : `Chapter ${chapter.number} ${chapter.title}`}
                  </h3>
                  <span className="shrink-0 text-[10px] text-muted-foreground/60">
                    {chapter.wordCount.toLocaleString()} {isZh ? "字" : "words"}
                  </span>
                </div>
                <div className="whitespace-pre-wrap break-words rounded-xl border border-border/40 bg-background/35 px-4 py-3 text-[13px] leading-7 text-foreground/85">
                  {trimHeading(chapter.content) || (isZh ? "本章暂时没有正文。" : "This chapter has no content yet.")}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
