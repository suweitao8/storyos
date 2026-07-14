import { useMemo, useState } from "react";
import { FileText } from "lucide-react";

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

type StorySectionGroup = "settings" | "world" | "outline";
type StorySettingsTab = StorySectionGroup | "chapters";

export function groupStorySection(section: Pick<StorySection, "file" | "title">): StorySectionGroup {
  const file = section.file.toLowerCase();
  const title = section.title.toLowerCase();
  if (file.includes("story_frame") || title.includes("设定")) return "settings";
  if (title.includes("题材") || title.includes("受众") || title.includes("标题方向") || title.includes("核心压力")) return "settings";
  if (title.includes("角色") || title.includes("人物") || title.includes("关系")) return "settings";
  if (file.includes("rule") || title.includes("规则") || title.includes("世界")) return "world";
  if (file.includes("outline") || title.includes("大纲") || title.includes("走向") || title.includes("提纲")) return "outline";
  return "settings";
}

export function trimStoryHeading(content: string): string {
  return content.replace(/^\uFEFF?\s*#\s+[^\n]+\n?/, "").trim();
}

export function hasStorySettingsContent(value: { readonly sections?: ReadonlyArray<unknown>; readonly chapters?: ReadonlyArray<unknown> } | null | undefined): boolean {
  return Boolean((value?.sections?.length ?? 0) > 0 || (value?.chapters?.length ?? 0) > 0);
}

const GROUP_LABELS: Record<StorySectionGroup, { readonly zh: string; readonly en: string }> = {
  settings: { zh: "故事设定", en: "Story setup" },
  world: { zh: "世界观与规则", en: "World and rules" },
  outline: { zh: "故事大纲", en: "Outline" },
};

export interface StorySettingsTabItem {
  readonly id: StorySettingsTab;
  readonly label: string;
}

export function buildStorySettingsTabItems(
  groups: ReadonlyArray<readonly [StorySectionGroup, ReadonlyArray<unknown>]>,
  chapterCount: number,
  isZh: boolean,
  isShortStory = false,
): ReadonlyArray<StorySettingsTabItem> {
  return [
    ...groups.map(([group]) => ({
      id: group,
      label: GROUP_LABELS[group][isZh ? "zh" : "en"],
    })),
    ...(chapterCount > 0 ? [{ id: "chapters" as const, label: isShortStory ? (isZh ? "故事正文" : "Story text") : (isZh ? "章节" : "Chapters") }] : []),
  ];
}

interface StorySettingsPanelProps {
  readonly bookId: string | null;
  readonly storyId: string | null;
  readonly theme: Theme;
  readonly isZh: boolean;
}

export function StorySettingsPanel({ bookId, storyId, theme: _theme, isZh }: StorySettingsPanelProps) {
  const path = storyId ? `/shorts/${encodeURIComponent(storyId)}/content` : bookId ? `/books/${encodeURIComponent(bookId)}/content` : "";
  const { data, loading, error } = useApi<StoryContentResponse>(path);
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

  if (!loading && (!bookId && !storyId || data && !hasStorySettingsContent(data))) {
    return (
      <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card/20" data-testid="story-settings-panel">
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <DocumentEmpty text={isZh ? "暂无内容" : "No content"} />
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card/20" data-testid="story-settings-panel">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!bookId && !storyId ? <DocumentEmpty text={isZh ? "创建故事后，这里会显示故事设定。" : "Story settings will appear after creation."} /> : loading && !data ? <DocumentEmpty text={isZh ? "正在加载故事设定..." : "Loading story settings..."} /> : error ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : !data ? <DocumentEmpty text={isZh ? "暂时没有故事设定。" : "No story settings yet."} /> : (
          <div>
            {tabs.length > 0 ? (
              <nav className="sticky top-0 z-10 bg-background/95 px-6 py-2 backdrop-blur" aria-label={isZh ? "故事设定分区" : "Story setting sections"}>
                <div className="flex min-w-max gap-1 overflow-x-auto" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selectedTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-lg px-3 py-2 text-sm transition-colors ${selectedTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </nav>
            ) : null}
            {selectedTab === "chapters" ? (
              <section className="space-y-4 px-6 py-7" role="tabpanel">
                <div className="space-y-5">{data.chapters.map((chapter) => <article key={chapter.number} className="rounded-2xl border border-border/50 bg-card p-5"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-semibold">{isZh ? `第 ${chapter.number} 章 ${chapter.title}` : `Chapter ${chapter.number} ${chapter.title}`}</h3><span className="text-xs text-muted-foreground">{chapter.wordCount.toLocaleString()} {isZh ? "字" : "words"}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/80">{trimStoryHeading(chapter.content) || (isZh ? "本章暂时没有正文。" : "This chapter has no content yet.")}</p></article>)}</div>
              </section>
            ) : selectedGroup ? (
              <section className="space-y-4 px-6 py-7" role="tabpanel">
                <div className="grid gap-5 lg:grid-cols-2">{selectedGroup[1].map((section) => <DocumentCard key={section.file} section={section} />)}</div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function DocumentCard({ section }: { readonly section: StorySection }) {
  const sourceFile = section.file.split("#", 1)[0];
  return <article className="rounded-2xl border border-border/50 bg-card p-5"><div className="flex items-center gap-2"><FileText size={15} className="text-primary" /><h3 className="font-semibold">{section.title}</h3><span className="truncate text-xs text-muted-foreground/70">{sourceFile}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/80">{trimStoryHeading(section.content)}</p></article>;
}

function DocumentEmpty({ text }: { readonly text: string }) {
  return <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-border/60 text-center text-sm text-muted-foreground">{text}</div>;
}
