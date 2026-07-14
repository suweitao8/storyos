import { useState, useEffect, lazy, Suspense } from "react";
import { useHashRoute } from "./hooks/use-hash-route";
import type { HashRoute } from "./hooks/use-hash-route";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { ChatPage, latestShortStoryId } from "./pages/ChatPage";
import { BookDetail } from "./pages/BookDetail";
import { ChapterReader } from "./pages/ChapterReader";
import { Analytics } from "./pages/Analytics";
import { ServiceDetailPage } from "./pages/ServiceDetailPage";
import { ProjectSettings } from "./pages/ProjectSettings";
import { SkillManager } from "./pages/SkillManager";
import { TruthFiles } from "./pages/TruthFiles";
import { DaemonControl } from "./pages/DaemonControl";
import { LogViewer } from "./pages/LogViewer";
import { GenreManager } from "./pages/GenreManager";
import { PromptTemplatePage } from "./pages/PromptTemplatePage";
import { CraftManager } from "./pages/CraftManager";
import { ImportManager } from "./pages/ImportManager";
import { RadarView } from "./pages/RadarView";
import { StoryPlayer } from "./pages/StoryPlayer";
import { StoryGraphTree } from "./pages/StoryGraphTree";
const FlowView = lazy(() => import("./pages/FlowView"));
const FilmWizard = lazy(() => import("./pages/FilmWizard"));
import { LanguageSelector } from "./pages/LanguageSelector";
import { BookSidebar, BookSidebarToggle } from "./components/chat/BookSidebar";
import { useSSE } from "./hooks/use-sse";
import { useSessionEvents } from "./hooks/use-session-events";
import { useTheme } from "./hooks/use-theme";
import { useI18n } from "./hooks/use-i18n";
import { setAppLanguage, tr } from "./lib/app-language";
import { postApi, putApi, useApi } from "./hooks/use-api";
import { PageToolbar, PageToolbarProvider, usePageToolbarState } from "./components/PageToolbar";
import { useChatStore, type ChatSessionKind } from "./store/chat";
import { getLastSelectedShortStoryId, setLastSelectedShortStoryId } from "./pages/chat-page-state";
import { resolveDefaultCraftSelection } from "./pages/craft-navigation-state";

export type { HashRoute as Route } from "./hooks/use-hash-route";

const PROJECT_CONFIG_RETRY = {
  retry: {
    retries: 2,
    delayMs: 250,
  },
} as const;

export function deriveActiveBookId(route: HashRoute): string | undefined {
  if ("bookId" in route) return route.bookId;
  return undefined;
}

export function isBookCreateChatRoute(route: HashRoute): boolean {
  return route.page === "book-create";
}

export const APP_PAGE_LAYOUT_CLASSES = {
  default: "w-full max-w-[1440px] mx-auto px-6 py-10 md:px-10 xl:px-12",
  wide: "w-full max-w-[1600px] mx-auto px-6 py-8 md:px-10 xl:px-12",
} as const;

export function getAppPageLayoutClass(page: HashRoute["page"]): string {
  return page === "craft" || page === "genres"
    ? APP_PAGE_LAYOUT_CLASSES.wide
    : APP_PAGE_LAYOUT_CLASSES.default;
}

export function getRouteToolbarTitle(
  route: HashRoute,
  lang: "zh" | "en",
  sessionKind?: ChatSessionKind,
): string {
  if (route.page === "chat" && sessionKind === "short") {
    return lang === "zh" ? "短篇故事" : "Short Story";
  }

  if (route.page === "short") {
    return lang === "zh" ? "短篇故事" : "Short Story";
  }

  const titles = lang === "zh"
    ? {
        dashboard: "项目总览",
        chat: "聊天",
        book: "写作",
        "book-settings": "书籍设置",
        "book-create": "长篇故事",
        services: "模型配置",
        "project-settings": "设置",
        "service-detail": "服务配置",
        chapter: "章节阅读",
        analytics: "数据分析",
        truth: "知识库",
        daemon: "守护进程",
        logs: "日志",
        genres: "题材",
        "prompt-templates": "提示词模板",
        skills: "Skill",
        craft: "写作模式",
        import: "导入",
        radar: "市场雷达",
        doctor: "设置",
        play: "互动世界",
        film: "故事图谱",
        flow: "流程图",
        "film-author": "互动剧本",
        "film-studio": "创作向导",
      }
    : {
        dashboard: "Dashboard",
        chat: "Chat",
        book: "Writing",
        "book-settings": "Book Settings",
        "book-create": "Long Novel",
        services: "Model Configuration",
        "project-settings": "Settings",
        "service-detail": "Service Configuration",
        chapter: "Chapter Reader",
        analytics: "Analytics",
        truth: "Knowledge Base",
        daemon: "Daemon",
        logs: "Logs",
        genres: "Genres",
        "prompt-templates": "Prompt Templates",
        skills: "Skill",
        craft: "Writing Modes",
        import: "Import",
        radar: "Market Radar",
        doctor: "Settings",
        play: "Interactive World",
        film: "Story Graph",
        flow: "Flow",
        "film-author": "Interactive Script",
        "film-studio": "Creation Wizard",
      };

  return titles[route.page];
}

type ToolbarStory = {
  readonly id: string;
  readonly title: string;
};

type ToolbarCraft = {
  readonly id: string;
  readonly sourceName: string;
};

export function resolveActiveShortStoryId(input: {
  readonly route: HashRoute;
  readonly sessionKind?: ChatSessionKind;
  readonly activeShortStoryId?: string | null;
  readonly recentShortStoryId?: string | null;
  readonly shorts: ReadonlyArray<ToolbarStory>;
}): string | null {
  const isShortSurface = input.route.page === "short"
    || (input.route.page === "chat" && input.sessionKind === "short");
  if (!isShortSurface) return null;

  const availableStoryIds = new Set(input.shorts.map((story) => story.id));
  const pickAvailable = (storyId: string | null | undefined): string | null =>
    storyId && availableStoryIds.has(storyId) ? storyId : null;

  const routeStoryId = input.route.page === "short" ? input.route.shortId : null;
  return pickAvailable(routeStoryId)
    ?? pickAvailable(input.recentShortStoryId)
    ?? pickAvailable(input.activeShortStoryId)
    ?? input.shorts[0]?.id
    ?? null;
}

export function resolveActiveStoryTitle(input: {
  readonly route: HashRoute;
  readonly lang?: "zh" | "en";
  readonly sessionKind?: ChatSessionKind;
  readonly activeBookId?: string | null;
  readonly activeShortStoryId?: string | null;
  readonly books: ReadonlyArray<ToolbarStory>;
  readonly shorts: ReadonlyArray<ToolbarStory>;
}): string | undefined {
  const route = input.route;
  const noContent = input.lang === "en" ? "No content" : "无内容";

  if (route.page === "book") {
    return input.books.find((book) => book.id === route.bookId)?.title ?? noContent;
  }

  if (route.page === "short") {
    return input.shorts.find((story) => story.id === route.shortId)?.title ?? noContent;
  }

  if (route.page === "chat" && input.sessionKind === "short") {
    return input.shorts.find((story) => story.id === input.activeShortStoryId)?.title ?? noContent;
  }

  if (route.page === "book-create") {
    const activeBook = input.books.find((book) => book.id === input.activeBookId) ?? input.books[0];
    return activeBook?.title ?? (input.lang !== "en" ? "无内容" : "No content");
  }

  if (route.page === "craft") {
    return noContent;
  }

  return undefined;
}

export function resolveActiveCraftTitle(input: {
  readonly crafts: ReadonlyArray<ToolbarCraft>;
  readonly recentCraftId?: string | null;
  readonly lang?: "zh" | "en";
}): string {
  const craftId = resolveDefaultCraftSelection(
    input.crafts.map((craft) => craft.id),
    input.recentCraftId ?? null,
  );
  return input.crafts.find((craft) => craft.id === craftId)?.sourceName
    ?? (input.lang === "en" ? "No content" : "无内容");
}

function AppPageToolbar({
  title,
  activeStoryTitle,
}: {
  readonly title: string;
  readonly activeStoryTitle?: string;
}) {
  const toolbar = usePageToolbarState();
  return (
    <PageToolbar
      title={title}
      titleMeta={activeStoryTitle ? (
        <span className="min-w-0 max-w-[240px] truncate text-sm font-normal text-muted-foreground">
          {activeStoryTitle}
        </span>
      ) : undefined}
      tabs={toolbar.tabs}
      activeTab={toolbar.activeTab}
      onTabChange={toolbar.onTabChange}
    />
  );
}

export function deriveStartupGate(input: {
  readonly ready: boolean;
  readonly projectError: string | null;
}): "ready" | "loading" | "error" {
  if (input.ready) return "ready";
  return input.projectError ? "error" : "loading";
}

export function App() {
  const { route, setRoute } = useHashRoute();
  const sse = useSSE();
  const { theme, setTheme } = useTheme();
  const { t, lang: currentLang } = useI18n();
  const activeSession = useChatStore((state) =>
    state.activeSessionId ? state.sessions[state.activeSessionId] : undefined,
  );
  const activeSessionKind = activeSession?.sessionKind;
  const { data: project, error: projectError, refetch: refetchProject } = useApi<{ language: string; languageExplicit: boolean }>("/project", PROJECT_CONFIG_RETRY);
  const { data: booksForToolbar } = useApi<{ books: ReadonlyArray<{ readonly id: string; readonly title: string }> }>("/books");
  const { data: shortsForToolbar } = useApi<{ shorts: ReadonlyArray<{ readonly id: string; readonly title: string }> }>("/shorts");
  const { data: craftsForToolbar } = useApi<{
    readonly crafts: ReadonlyArray<ToolbarCraft>;
    readonly recentCraftId: string | null;
  }>("/crafts");
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [ready, setReady] = useState(false);
  const [recentShortStoryId, setRecentShortStoryId] = useState<string | null>(() =>
    getLastSelectedShortStoryId(),
  );

  const isDark = theme === "dark";

  // 全局语言同步：app-language 是模块级单例，供用不了 hook 的代码（lib 纯函数、
  // store slice）读取。这里在渲染期同步赋值，让子组件在同一次渲染里调用 tr() 时
  // 就读到正确语言（只用 effect 的话，effect 要等本次渲染提交后才执行，本次渲染
  // 里的 tr() 会读到旧语言）。赋值是幂等的模块变量写入，StrictMode 重复渲染无影
  // 响；下面的 effect 在语言加载完成和切换时再设置一次，保证提交后的值也正确。
  setAppLanguage(currentLang);
  useEffect(() => {
    setAppLanguage(currentLang);
  }, [currentLang]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    if (project) {
      if (!project.languageExplicit) {
        setShowLanguageSelector(true);
      }
      setReady(true);
    }
  }, [project]);

  useSessionEvents(sse, route, setRoute);

  const nav = {
    toDashboard: () => setRoute({ page: "dashboard" }),
    toChat: () => setRoute({ page: "chat" }),
    toBook: (bookId: string) => setRoute({ page: "book", bookId }),
    toShort: (shortId: string) => setRoute({ page: "short", shortId }),
    toBookSettings: (bookId: string) => setRoute({ page: "book-settings", bookId }),
    toBookCreate: () => setRoute({ page: "book-create" }),
    toChapter: (bookId: string, chapterNumber: number) =>
      setRoute({ page: "chapter", bookId, chapterNumber }),
    toAnalytics: (bookId: string) => setRoute({ page: "analytics", bookId }),
    toServices: () => setRoute({ page: "project-settings" }),
    toProjectSettings: () => setRoute({ page: "project-settings" }),
    toServiceDetail: (id: string) => setRoute({ page: "service-detail", serviceId: id }),
    toTruth: (bookId: string) => setRoute({ page: "truth", bookId }),
    toDaemon: () => setRoute({ page: "daemon" }),
    toLogs: () => setRoute({ page: "logs" }),
    toPromptTemplates: () => setRoute({ page: "prompt-templates" }),
    toCraft: () => setRoute({ page: "craft" }),
    toImport: (tab?: "chapters" | "canon" | "fanfic" | "spinoff") => setRoute({ page: "import", ...(tab ? { tab } : {}) }),
    toRadar: () => setRoute({ page: "radar" }),
    toPlay: (projectId: string) => setRoute({ page: "play", projectId }),
    toFilm: (projectId: string) => setRoute({ page: "film", projectId }),
    toFlow: (projectId: string) => setRoute({ page: "flow", projectId }),
    toFilmAuthor: (projectId: string) => setRoute({ page: "film-author", projectId }),
    toFilmStudio: (projectId: string) => setRoute({ page: "film-studio", projectId }),
  };

  const activeBookId = deriveActiveBookId(route);
  const activePage =
    activeBookId
      ? `book:${activeBookId}`
      : route.page === "short"
        ? `short:${route.shortId}`
      : route.page === "service-detail"
        ? "services"
        : route.page;

  const startupGate = deriveStartupGate({ ready, projectError });
  const activeShortStoryId = activeSessionKind === "short"
    ? latestShortStoryId(activeSession?.messages ?? [])
    : null;
  const selectedShortStoryId = resolveActiveShortStoryId({
    route,
    sessionKind: activeSessionKind,
    activeShortStoryId,
    recentShortStoryId,
    shorts: shortsForToolbar?.shorts ?? [],
  });

  useEffect(() => {
    const storyId = route.page === "short"
      ? route.shortId
      : activeSessionKind === "short"
        ? selectedShortStoryId
        : null;
    if (!storyId || storyId === recentShortStoryId) return;
    setRecentShortStoryId(storyId);
    setLastSelectedShortStoryId(storyId);
  }, [activeSessionKind, recentShortStoryId, route, selectedShortStoryId]);

  const activeStoryTitle = resolveActiveStoryTitle({
    route,
    lang: currentLang,
    sessionKind: activeSessionKind,
    activeBookId: activeSession?.bookId,
    activeShortStoryId: selectedShortStoryId,
    books: booksForToolbar?.books ?? [],
    shorts: shortsForToolbar?.shorts ?? [],
  });
  const toolbarStoryTitle = route.page === "craft"
    ? resolveActiveCraftTitle({
      crafts: craftsForToolbar?.crafts ?? [],
      recentCraftId: craftsForToolbar?.recentCraftId,
      lang: currentLang,
    })
    : activeStoryTitle;

  if (startupGate === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-destructive">无法加载项目配置 / Failed to load project config</h1>
            <p className="mt-2 text-sm text-muted-foreground break-all">{projectError}</p>
          </div>
          {/* 项目配置没加载出来，语言未知，所以这屏中英双语并排展示。 */}
          <p className="text-sm text-muted-foreground">
            请检查项目根目录下的 inkos.json 是否存在且为合法 JSON，然后重试。
            <br />
            Check that inkos.json in the project root exists and is valid JSON, then retry.
          </p>
          <button
            type="button"
            onClick={() => refetchProject()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            重试 / Retry
          </button>
        </div>
      </div>
    );
  }

  if (startupGate === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (showLanguageSelector) {
    return (
      <LanguageSelector
        onSelect={async (lang) => {
          await postApi("/project/language", { language: lang });
          setShowLanguageSelector(false);
          refetchProject();
        }}
      />
    );
  }

  return (
    <PageToolbarProvider>
      <div className="h-screen bg-background text-foreground flex overflow-hidden font-sans">
      {/* Left Sidebar */}
      <Sidebar nav={nav} activePage={activePage} sse={sse} t={t} />

      {/* Center Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/30 backdrop-blur-sm">
        {/* Header Strip — kept as a thin divider; navigation lives in the sidebar */}
        <div className="h-px shrink-0 border-b border-border/40" />

        <AppPageToolbar
          title={getRouteToolbarTitle(route, currentLang, activeSessionKind)}
          activeStoryTitle={toolbarStoryTitle}
        />

        {/* Main Content Area */}
        <main className="flex-1 relative overflow-y-auto scroll-smooth">
          {route.page === "dashboard" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <Dashboard nav={nav} sse={sse} theme={theme} t={t} />
            </div>
          )}
          {isBookCreateChatRoute(route) && (
            <div className="absolute inset-0 flex min-w-0">
              <ChatPage
                mode="book-create"
                nav={nav}
                theme={theme}
                t={t}
                sse={sse}
              />
            </div>
          )}
          {route.page === "chat" && (
            <div className="absolute inset-0 flex min-w-0">
              <ChatPage
                activeShortId={activeSessionKind === "short" ? selectedShortStoryId ?? undefined : undefined}
                mode="project-chat"
                nav={nav}
                theme={theme}
                t={t}
                sse={sse}
              />
            </div>
          )}
          {route.page === "book" && (
            <div className="absolute inset-0 flex min-w-0">
              <ChatPage
                activeBookId={route.bookId}
                mode="book"
                nav={nav}
                theme={theme}
                t={t}
                sse={sse}
              />
              <BookSidebar bookId={route.bookId} theme={theme} t={t} sse={sse} />
              <BookSidebarToggle bookId={route.bookId} theme={theme} t={t} sse={sse} />
            </div>
          )}
          {route.page === "short" && (
            <div className="absolute inset-0 flex min-w-0">
              <ChatPage
                activeShortId={route.shortId}
                mode="short"
                nav={nav}
                theme={theme}
                t={t}
                sse={sse}
              />
            </div>
          )}
          {route.page === "book-settings" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <BookDetail bookId={route.bookId} nav={nav} theme={theme} t={t} sse={sse} />
            </div>
          )}
          {route.page === "chapter" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <ChapterReader bookId={route.bookId} chapterNumber={route.chapterNumber} nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "analytics" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <Analytics bookId={route.bookId} nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "project-settings" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <ProjectSettings
                theme={theme}
                lang={currentLang}
                setTheme={setTheme}
                onLangChange={async (nextLang) => {
                  await putApi("/project", { language: nextLang });
                  refetchProject();
                }}
                t={t}
              />
            </div>
          )}
          {route.page === "service-detail" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <ServiceDetailPage serviceId={route.serviceId} nav={nav} />
            </div>
          )}
          {route.page === "truth" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <TruthFiles bookId={route.bookId} nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "daemon" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <DaemonControl nav={nav} theme={theme} t={t} sse={sse} />
            </div>
          )}
          {route.page === "logs" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <LogViewer nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "genres" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <GenreManager theme={theme} t={t} />
            </div>
          )}
          {route.page === "prompt-templates" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <PromptTemplatePage theme={theme} t={t} />
            </div>
          )}
          {route.page === "skills" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <SkillManager theme={theme} lang={currentLang} t={t} />
            </div>
          )}
          {route.page === "craft" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <CraftManager nav={nav} theme={theme} t={t} sse={sse} />
            </div>
          )}
          {route.page === "import" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <ImportManager nav={nav} theme={theme} t={t} initialTab={route.tab} />
            </div>
          )}
          {route.page === "radar" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <RadarView nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "play" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <StoryPlayer projectId={route.projectId} nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "film" && (
            <div className={`${getAppPageLayoutClass(route.page)} fade-in`}>
              <StoryGraphTree projectId={route.projectId} nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "film-author" && (
            <div className="absolute inset-0 flex min-w-0">
              <ChatPage
                activeBookId={route.projectId}
                mode="interactive-film-authoring"
                nav={nav}
                theme={theme}
                t={t}
                sse={sse}
              />
            </div>
          )}
          {route.page === "film-studio" && (
            <Suspense fallback={<div className="p-6 text-sm">{tr("加载创作向导…", "Loading creation wizard…")}</div>}>
              <FilmWizard projectId={route.projectId} nav={nav} theme={theme} t={t} sse={sse} />
            </Suspense>
          )}
          {route.page === "flow" && (
            <Suspense fallback={<div className="p-6 text-sm">{tr("加载流程图…", "Loading flow view…")}</div>}>
              <FlowView projectId={route.projectId} nav={nav} theme={theme} t={t} />
            </Suspense>
          )}
        </main>
      </div>
      </div>
    </PageToolbarProvider>
  );
}
