import { useEffect, useState } from "react";
import { Boxes, Globe, Moon, Stethoscope, Sun } from "lucide-react";
import { usePageToolbar } from "../components/PageToolbar";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { EnvironmentDiagnostics } from "./DoctorView";
import { ServiceListPage } from "./ServiceListPage";
import { GenreManager } from "./GenreManager";
import type { ProjectSettingsTabId } from "../hooks/use-hash-route";

export const PROJECT_SETTINGS_TAB_IDS = ["common", "genres", "diagnostics"] as const;
type ProjectSettingsTab = typeof PROJECT_SETTINGS_TAB_IDS[number];

function SettingsCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const fieldClass = "w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-primary/50";

export function ProjectSettings({ theme, setTheme, lang, onLangChange, t, initialTab }: {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  lang: "zh" | "en";
  onLangChange: (lang: "zh" | "en") => void;
  t: TFunction;
  initialTab?: ProjectSettingsTabId;
}) {
  const c = useColors(theme);
  const isZh = lang === "zh";
  const [activeTab, setActiveTab] = useState<ProjectSettingsTab>(initialTab ?? "common");

  useEffect(() => {
    setActiveTab(initialTab ?? "common");
  }, [initialTab]);

  usePageToolbar("project-settings", {
    tabs: [
      { id: "common", label: t("settings.tab.common"), icon: <Globe size={14} /> },
      { id: "genres", label: t("settings.tab.genres"), icon: <Boxes size={14} /> },
      { id: "diagnostics", label: t("settings.tab.diagnostics"), icon: <Stethoscope size={14} /> },
    ],
    activeTab,
    onTabChange: (next) => setActiveTab(next as ProjectSettingsTab),
  });

  return (
    <div className="space-y-6">
      {activeTab === "common" && (
        <div className="space-y-6">
        <SettingsCard title={t("settings.general")} icon={<Globe size={18} />}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground min-w-fit">{t("settings.language")}:</span>
              <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => onLangChange("zh")}
                  className={`px-2.5 py-1 text-sm font-medium rounded-md ${lang === "zh" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  中文
                </button>
                <button
                  type="button"
                  onClick={() => onLangChange("en")}
                  className={`px-2.5 py-1 text-sm font-medium rounded-md ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  EN
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground min-w-fit">{t("settings.theme")}:</span>
              <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`px-2.5 py-1 text-sm font-medium rounded-md flex items-center gap-1 ${theme === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  <Sun size={14} />
                  {t("settings.themeLight")}
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`px-2.5 py-1 text-sm font-medium rounded-md flex items-center gap-1 ${theme === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  <Moon size={14} />
                  {t("settings.themeDark")}
                </button>
              </div>
            </div>
          </SettingsCard>

          <ServiceListPage />
        </div>
      )}

      {activeTab === "genres" && (
        <GenreManager theme={theme} t={t} />
      )}

      {activeTab === "diagnostics" && (
        <EnvironmentDiagnostics theme={theme} t={t} />
      )}
    </div>
  );
}
