import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, FileText } from "lucide-react";

import type { Theme } from "../hooks/use-theme";
import { useApi } from "../hooks/use-api";

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

type StorySectionGroup = "settings" | "world" | "outline" | "characters" | "other";
type StorySettingsTab = StorySectionGroup | "chapters";

export function groupStorySection(section: Pick<StorySection, "file" | "title">): StorySectionGroup {
  const file = section.file.toLowerCase();
  const title = section.title.toLowerCase();
  if (file.includes("roles/") || title.includes("角色") || title.includes("人物") || title.includes("关系")) return "characters";
  if (file.includes("story_frame") || title.includes("设定")) return "settings";
  if (title.includes("题材") || title.includes("受众") || title.includes("标题方向") || title.includes("核心压力")) return "settings";
  if (file.includes("rule") || title.includes("规则") || title.includes("世界")) return "world";
  if (file.includes("outline") || title.includes("大纲") || title.includes("走向") || title.includes("提纲")) return "outline";
  return "other";
}

export function trimStoryHeading(content: string): string {
  return content.replace(/^\uFEFF?\s*#\s+[^\n]+\n?/, "").trim();
}

const GROUP_LABELS: Record<StorySectionGroup, { readonly zh: string; readonly en: string }> = {
  settings: { zh: "故事设定", en: "Story setup" },
  world: { zh: "世界观与规则", en: "World and rules" },
  outline: { zh: "故事大纲", en: "Outline" },
  characters: { zh: "角色", en: "Characters" },
  other: { zh: "其他设定", en: "Other notes" },
};

export interface StorySettingsTabItem {
  readonly id: StorySettingsTab;
  readonly label: string;
  readonly count: number;
}

export function buildStorySettingsTabItems(
  groups: ReadonlyArray<readonly [StorySectionGroup, ReadonlyArray<unknown>]>,
  chapterCount: number,
  isZh: boolean,
  isShortStory = false,
): ReadonlyArray<StorySettingsTabItem> {
  return [
    ...groups.map(([group, sections]) => ({
      id: group,
      label: GROUP_LABELS[group][isZh ? "zh" : "en"],
      count: sections.length,
    })),
    ...(chapterCount > 0 ? [{ id: "chapters" as const, label: isShortStory ? (isZh ? "故事正文" : "Story text") : (isZh ? "章节" : "Chapters"), count: isShortStory ? 0 : chapterCount }] : []),
  ];
}

interface StorySettingsPanelProps {
  readonly bookId: string | null;
  readonly storyId: string | null;
  readonly theme: Theme;
  readonly isZh: boolean;
  readonly onOpenAdjustment: () => void;
}

export function StorySettingsPanel({ bookId, storyId, theme: _theme, isZh, onOpenAdjustment }: StorySettingsPanelProps) {
  const path = storyId ? `/shorts/${encodeURIComponent(storyId)}/content` : bookId ? `/books/${encodeURIComponent(bookId)}/content` : "";
  const { data, loading, error, refetch } = useApi<StoryContentResponse>(path);
  const [activeTab, setActiveTab] = useState<StorySettingsTab>("settings");
  const isShortStory = Boolean(storyId);
  const groups = useMemo(() => {
    const grouped = new Map<StorySectionGroup, StorySection[]>();
    for (const section of data?.sections ?? []) {
      const group = groupStorySection(section);
      const current = grouped.get(group) ?? [];
      current.push(section);
      grouped.set(group, current);
    }
    return [...grouped.entries()];
  }, [data?.sections]);
  const tabs = useMemo(() => buildStorySettingsTabItems(groups, data?.chapters.length ?? 0, isZh, isShortStory), [data?.chapters.length, groups, isShortStory, isZh]);
  const selectedTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : (tabs[0]?.id ?? "settings");
  const selectedGroup = selectedTab === "chapters" ? undefined : groups.find(([group]) => group === selectedTab);
  const wordCount = (data?.chapters ?? []).reduce((total, chapter) => total + (chapter.wordCount || 0), 0);

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card/20" data-testid="story-settings-panel">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-border/40 px-6 py-6">
        <div className="flex min-w-0 items-start gap-3">
          <BookOpen size={21} className="mt-1 shrink-0 text-primary" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{data?.book.title ?? (isZh ? "故事设定" : "Story settings")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{isZh ? "按故事设定、角色和大纲分组查看生成内容。" : "Review generated content grouped by setup, characters, and outline."}</p>
          </div>
        </div>
        <button type="button" onClick={onOpenAdjustment} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground"><ArrowRight size={15} />{isZh ? "打开对话调整" : "Open chat adjustment"}</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7">
        {!bookId && !storyId ? <DocumentEmpty text={isZh ? "创建故事后，这里会显示故事设定。" : "Story settings will appear after creation."} /> : loading && !data ? <DocumentEmpty text={isZh ? "正在加载故事设定..." : "Loading story settings..."} /> : error ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : !data ? <DocumentEmpty text={isZh ? "暂时没有故事设定。" : "No story settings yet."} /> : (
          <div className="space-y-8">
            <div className={`grid gap-3 ${isShortStory ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
              <MetadataCard label={isZh ? "类型" : "Type"} value={data.book.genre || (isZh ? "未设置" : "Not set")} />
              <MetadataCard label={isZh ? "字数" : "Words"} value={`${wordCount.toLocaleString()} ${isZh ? "字" : "words"}`} />
              {!isShortStory ? <MetadataCard label={isZh ? "章节" : "Chapters"} value={`${data.chapters.length}${data.book.targetChapters ? ` / ${data.book.targetChapters}` : ""}`} /> : null}
            </div>
            {tabs.length > 0 ? (
              <nav className="sticky top-0 z-10 -mx-2 overflow-x-auto rounded-xl border border-border/50 bg-background/90 p-1 backdrop-blur" aria-label={isZh ? "故事设定分区" : "Story setting sections"}>
                <div className="flex min-w-max gap-1" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selectedTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-lg px-3 py-2 text-sm transition-colors ${selectedTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"}`}
                    >
                      {tab.label}<span className={`ml-1.5 text-xs ${selectedTab === tab.id ? "text-primary-foreground/75" : "text-muted-foreground/70"}`}>{tab.count}</span>
                    </button>
                  ))}
                </div>
              </nav>
            ) : null}
            {selectedTab === "chapters" ? (
              <section className="space-y-4" role="tabpanel">
                <div className="space-y-5">{data.chapters.map((chapter) => <article key={chapter.number} className="rounded-2xl border border-border/50 bg-card p-5"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-semibold">{isZh ? `第 ${chapter.number} 章 ${chapter.title}` : `Chapter ${chapter.number} ${chapter.title}`}</h3><span className="text-xs text-muted-foreground">{chapter.wordCount.toLocaleString()} {isZh ? "字" : "words"}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/80">{trimStoryHeading(chapter.content) || (isZh ? "本章暂时没有正文。" : "This chapter has no content yet.")}</p></article>)}</div>
              </section>
            ) : selectedGroup ? (
              <section className="space-y-4" role="tabpanel">
                <h2 className="flex items-center gap-2 text-base font-semibold"><span className="h-5 w-1 rounded-full bg-primary" />{GROUP_LABELS[selectedGroup[0]][isZh ? "zh" : "en"]}</h2>
                <div className="grid gap-5 lg:grid-cols-2">{selectedGroup[1].map((section) => <DocumentCard key={section.file} section={section} />)}</div>
              </section>
            ) : null}
            <button type="button" onClick={() => void refetch()} disabled={loading} className="text-sm text-primary hover:underline disabled:opacity-50">{isZh ? "刷新文档" : "Refresh document"}</button>
          </div>
        )}
      </div>
    </section>
  );
}

function MetadataCard({ label, value }: { readonly label: string; readonly value: string }) {
  return <div className="rounded-xl border border-border/50 bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function DocumentCard({ section }: { readonly section: StorySection }) {
  const sourceFile = section.file.split("#", 1)[0];
  return <article className="rounded-2xl border border-border/50 bg-card p-5"><div className="flex items-center gap-2"><FileText size={15} className="text-primary" /><h3 className="font-semibold">{section.title}</h3><span className="truncate text-xs text-muted-foreground/70">{sourceFile}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/80">{trimStoryHeading(section.content)}</p></article>;
}

function DocumentEmpty({ text }: { readonly text: string }) {
  return <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-border/60 text-center text-sm text-muted-foreground">{text}</div>;
}
