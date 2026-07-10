import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageToolbarTab = {
  id: string;
  label: ReactNode;
};

export type PageToolbarProps = {
  title?: ReactNode;
  tabs?: readonly PageToolbarTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  leading?: ReactNode;
  actions?: ReactNode;
  globalActions?: ReactNode;
  className?: string;
};

export function PageToolbar({
  title,
  tabs = [],
  activeTab,
  onTabChange,
  leading,
  actions,
  globalActions,
  className,
}: PageToolbarProps) {
  return (
    <header
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-4 py-3",
        className,
      )}
    >
      {(leading || title != null) && (
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          {leading}
          {title != null && <h1 className="min-w-0 truncate text-lg font-semibold text-foreground">{title}</h1>}
        </div>
      )}

      {tabs.length > 0 && (
        <nav aria-label="页面导航" className="min-w-0 flex-1">
          <div data-testid="page-toolbar-tabs" className="min-w-0 overflow-x-auto">
            <div className="flex min-w-max items-center gap-1">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "shrink-0 px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => onTabChange?.(tab.id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      {globalActions && <div className="ml-auto flex shrink-0 items-center gap-2">{globalActions}</div>}
    </header>
  );
}
