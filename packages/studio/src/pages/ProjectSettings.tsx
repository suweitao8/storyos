import { useState } from "react";
import { Bot, Globe, Moon, Stethoscope, Sun, Trash2 } from "lucide-react";
import { fetchJson, postApi, putApi, useApi } from "../hooks/use-api";
import { usePreferencesStore } from "../store/preferences";
import { usePageToolbar } from "../components/PageToolbar";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import {
  createEmptySkillDraft,
  skillDraftFromSkill,
  skillDraftToPayload,
  type SkillDraft,
  type StudioSkill,
} from "./skill-ui-state";
import { EnvironmentDiagnostics } from "./DoctorView";
import { ServiceListPage } from "./ServiceListPage";

type NoticeTone = "success" | "error" | "info";

interface SkillsResponse {
  readonly skills: ReadonlyArray<StudioSkill>;
  readonly diagnostics?: ReadonlyArray<{ readonly path?: string; readonly message?: string }>;
}

function SettingsCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const fieldClass = "w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-primary/50";

export function ProjectSettings({ theme, setTheme, lang, onLangChange, t }: {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  lang: "zh" | "en";
  onLangChange: (lang: "zh" | "en") => void;
  t: TFunction;
}) {
  const c = useColors(theme);
  const isZh = lang === "zh";
  const { data: skillsData, refetch: refetchSkills } = useApi<SkillsResponse>("/skills");
  const [skillDraft, setSkillDraft] = useState<SkillDraft>(() => createEmptySkillDraft());
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"common" | "models" | "diagnostics">("common");
  const toolDetailsDefaultOpen = usePreferencesStore((s) => s.toolDetailsDefaultOpen);
  const setToolDetailsDefaultOpen = usePreferencesStore((s) => s.setToolDetailsDefaultOpen);
  const skills = skillsData?.skills ?? [];

  const runSave = async (key: string, work: () => Promise<void>, success: string) => {
    setSaving(key);
    setNotice(null);
    try {
      await work();
      setNotice({ tone: "success", message: success });
    } catch (e) {
      setNotice({ tone: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(null);
    }
  };

  usePageToolbar("project-settings", {
    tabs: [
      { id: "common", label: t("settings.tab.common"), icon: <Globe size={14} /> },
      { id: "models", label: t("settings.tab.models"), icon: <Bot size={14} /> },
      { id: "diagnostics", label: t("settings.tab.diagnostics"), icon: <Stethoscope size={14} /> },
    ],
    activeTab,
    onTabChange: (next) => setActiveTab(next as "common" | "models" | "diagnostics"),
  });

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            notice.tone === "error"
              ? "bg-destructive/10 text-destructive"
              : notice.tone === "info"
                ? "bg-secondary text-muted-foreground"
                : "bg-emerald-500/10 text-emerald-600"
          }`}
        >
          {notice.message}
        </div>
      )}

      {activeTab === "common" && (
        <div className="space-y-6">
        <SettingsCard title={t("settings.general")} description={t("settings.generalHint")} icon={<Globe size={18} />}>
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
            {/* Chat UI preference — applied immediately, persisted in this browser's localStorage */}
            <div className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={toolDetailsDefaultOpen}
                  onChange={(e) => setToolDetailsDefaultOpen(e.target.checked)}
                />
                {t("settings.toolDetailsDefaultOpen")}
              </label>
              <p className="text-xs text-muted-foreground">{t("settings.toolDetailsDefaultOpenHint")}</p>
            </div>
          </SettingsCard>

      <SettingsCard
        title={isZh ? "运行时 Skill" : "Runtime skills"}
        description={isZh ? "把可复用的专业能力保存到项目，Chat 可以自主使用，也可以在输入框用 + 号强制启用。" : "Save reusable expertise in the project. Chat can choose skills automatically, or you can force one from the + menu."}
        icon={<Bot size={18} />}
      >
        <div className="space-y-3">
          {skills.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{isZh ? "还没有 Skill。" : "No skills yet."}</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {skills.map((skill) => (
                <div key={skill.id} className="rounded-xl border border-border/60 bg-secondary/20 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold">{skill.name}</div>
                        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {skill.source ?? "skill"}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">@{skill.id}</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{skill.whenToUse || skill.description || (isZh ? "无说明" : "No description")}</p>
                    </div>
                    {skill.editable ? (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSkillId(skill.id);
                            setSkillDraft(skillDraftFromSkill(skill));
                          }}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        >
                          {isZh ? "编辑" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => runSave(`delete-skill:${skill.id}`, async () => {
                            await fetchJson(`/skills/${encodeURIComponent(skill.id)}`, { method: "DELETE" });
                            if (editingSkillId === skill.id) {
                              setEditingSkillId(null);
                              setSkillDraft(createEmptySkillDraft());
                            }
                            await refetchSkills();
                          }, isZh ? "Skill 已删除" : "Skill deleted")}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          aria-label={isZh ? `删除 ${skill.name}` : `Delete ${skill.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">
                  {editingSkillId ? (isZh ? "编辑项目 Skill" : "Edit project skill") : (isZh ? "新增项目 Skill" : "Add project skill")}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isZh ? "这些文件会保存到 .inkos/skills/<id>/SKILL.md。" : "Saved to .inkos/skills/<id>/SKILL.md."}
                </p>
              </div>
              {editingSkillId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSkillId(null);
                    setSkillDraft(createEmptySkillDraft());
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                >
                  {isZh ? "取消编辑" : "Cancel"}
                </button>
              ) : null}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={skillDraft.id}
                onChange={(e) => setSkillDraft((draft) => ({ ...draft, id: e.target.value }))}
                disabled={Boolean(editingSkillId)}
                placeholder="skill-id"
                className={`${fieldClass} font-mono disabled:opacity-50`}
              />
              <input
                value={skillDraft.name}
                onChange={(e) => setSkillDraft((draft) => ({ ...draft, name: e.target.value }))}
                placeholder={isZh ? "Skill 名称" : "Skill name"}
                className={fieldClass}
              />
              <input
                value={skillDraft.whenToUse}
                onChange={(e) => setSkillDraft((draft) => ({ ...draft, whenToUse: e.target.value }))}
                placeholder={isZh ? "什么时候使用" : "When to use"}
                className={`${fieldClass} md:col-span-2`}
              />
              <input
                value={skillDraft.triggers}
                onChange={(e) => setSkillDraft((draft) => ({ ...draft, triggers: e.target.value }))}
                placeholder={isZh ? "触发词，用逗号分隔" : "Triggers, comma separated"}
                className={fieldClass}
              />
              <input
                value={skillDraft.sessionKinds}
                onChange={(e) => setSkillDraft((draft) => ({ ...draft, sessionKinds: e.target.value }))}
                placeholder="chat,book,short,play"
                className={fieldClass}
              />
              <input
                value={skillDraft.promptPacks}
                onChange={(e) => setSkillDraft((draft) => ({ ...draft, promptPacks: e.target.value }))}
                placeholder={isZh ? "关联提示词包，如 play.renderer, longform.writer" : "Prompt packs, e.g. play.renderer, longform.writer"}
                className={`${fieldClass} md:col-span-2 font-mono`}
              />
              <textarea
                value={skillDraft.body}
                onChange={(e) => setSkillDraft((draft) => ({ ...draft, body: e.target.value }))}
                placeholder={isZh ? "写给模型的专业能力说明..." : "Instructions for the model..."}
                rows={5}
                className={`${fieldClass} leading-6 md:col-span-2`}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => runSave("skill", async () => {
                  const payload = skillDraftToPayload(skillDraft, !editingSkillId);
                  if (editingSkillId) {
                    await putApi(`/skills/${encodeURIComponent(editingSkillId)}`, payload);
                  } else {
                    await postApi("/skills", payload);
                  }
                  await refetchSkills();
                  setEditingSkillId(null);
                  setSkillDraft(createEmptySkillDraft());
                }, isZh ? "Skill 已保存" : "Skill saved")}
                disabled={saving === "skill" || !skillDraft.body.trim() || !skillDraftToPayload(skillDraft).id}
                className={`rounded-lg px-4 py-2 text-sm font-bold ${c.btnPrimary} disabled:opacity-40`}
              >
                {saving === "skill" ? t("config.saving") : t("config.save")}
              </button>
            </div>
          </div>
        </div>
      </SettingsCard>
        </div>
      )}

      {activeTab === "models" && (
        <ServiceListPage />
      )}

      {activeTab === "diagnostics" && (
        <EnvironmentDiagnostics theme={theme} t={t} />
      )}
    </div>
  );
}
