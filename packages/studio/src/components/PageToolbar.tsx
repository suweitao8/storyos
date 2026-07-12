import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export type PageToolbarTab = {
  readonly id: string;
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
};

export type PageToolbarProps = {
  readonly title?: ReactNode;
  readonly tabs?: readonly PageToolbarTab[];
  readonly activeTab?: string;
  readonly onTabChange?: (tabId: string) => void;
  readonly leading?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
};

export type PageToolbarRegistration = Pick<PageToolbarProps, "tabs" | "activeTab" | "onTabChange">;

type RegisteredPageToolbar = PageToolbarRegistration & { readonly ownerId: string };

type PageToolbarContextValue = {
  readonly registration: RegisteredPageToolbar | null;
  readonly register: (ownerId: string, registration: PageToolbarRegistration) => void;
  readonly unregister: (ownerId: string) => void;
};

const PageToolbarContext = createContext<PageToolbarContextValue | null>(null);

export function PageToolbarProvider({ children }: { readonly children: ReactNode }) {
  const [registration, setRegistration] = useState<RegisteredPageToolbar | null>(null);
  const register = useCallback((ownerId: string, next: PageToolbarRegistration) => {
    setRegistration({ ownerId, ...next });
  }, []);
  const unregister = useCallback((ownerId: string) => {
    setRegistration((current) => current?.ownerId === ownerId ? null : current);
  }, []);
  const value = useMemo(() => ({ registration, register, unregister }), [registration, register, unregister]);

  return <PageToolbarContext.Provider value={value}>{children}</PageToolbarContext.Provider>;
}

export function usePageToolbarState(): PageToolbarRegistration {
  const context = useContext(PageToolbarContext);
  if (!context) throw new Error("usePageToolbarState must be used within PageToolbarProvider");
  return context.registration ?? {};
}

export function usePageToolbar(ownerId: string, registration: PageToolbarRegistration): void {
  const context = useContext(PageToolbarContext);
  if (!context) throw new Error("usePageToolbar must be used within PageToolbarProvider");
  const { register, unregister } = context;

  const latestRegistrationRef = useRef(registration);
  latestRegistrationRef.current = registration;
  const tabsSignature = registration.tabs
    ?.map((tab) => `${tab.id}:${String(tab.label)}:${tab.disabled ? "disabled" : "enabled"}`)
    .join("|") ?? "";

  useEffect(() => {
    register(ownerId, {
      tabs: registration.tabs,
      activeTab: registration.activeTab,
      onTabChange: (tabId) => latestRegistrationRef.current.onTabChange?.(tabId),
    });
    return () => unregister(ownerId);
  }, [register, unregister, ownerId, registration.activeTab, tabsSignature]);
}

export function PageToolbar({
  title,
  tabs = [],
  activeTab,
  onTabChange,
  leading,
  actions,
  className,
}: PageToolbarProps) {
  return (
    <header
      className={cn(
        "min-w-0 border-b border-border/60 px-4 py-3",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {(leading || title != null) && (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {leading}
          {title != null && <h1 className="min-w-0 truncate text-lg font-semibold text-foreground">{title}</h1>}
        </div>
      )}

      {tabs.length > 0 && (
        <nav aria-label="页面导航" className="flex min-w-0 flex-1 justify-center">
          <div data-testid="page-toolbar-tabs" className="min-w-0 max-w-full overflow-x-auto">
            <div className="flex min-w-max items-center justify-center gap-1">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    disabled={tab.disabled}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      isActive
                        ? "border-b-2 border-primary text-primary"
                        : tab.disabled
                          ? "text-muted-foreground"
                          : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={tab.disabled ? undefined : () => onTabChange?.(tab.id)}
                  >
                    {tab.icon != null && (
                      <span aria-hidden="true" className="inline-flex shrink-0 items-center">
                        {tab.icon}
                      </span>
                    )}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
