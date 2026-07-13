import { useEffect, useState } from "react";
import { Bot, FileText, Globe, Moon, RotateCcw, Stethoscope, Sun, Trash2 } from "lucide-react";
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
import {
  groupPromptPacksForDisplay,
  type PromptPacksResponse,
} from "./prompt-pack-ui-state";
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
  const { data: promptPacksData, refetch: refetchPromptPacks } = useApi<PromptPacksResponse>("/prompt-packs");
  const [skillDraft, setSkillDraft] = useState<SkillDraft>(() => createEmptySkillDraft());
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"common" | "models" | "diagnostics">("common");
  const toolDetailsDefaultOpen = usePreferencesStore((s) => s.toolDetailsDefaultOpen);
  const setToolDetailsDefaultOpen = usePreferencesStore((s) => s.setToolDetailsDefaultOpen);
  const skills = skillsData?.skills ?? [];
  const promptGroups = groupPromptPacksForDisplay(promptPacksData ?? { packs: [], prompts: [] });
  const promptList = promptPacksData?.prompts ?? [];
  const selectedPrompt = promptList.find((prompt) => prompt.id === selectedPromptId) ?? null;
  const promptDirty = Boolean(selectedPrompt && promptDraft !== (selectedPrompt.content ?? ""));

  useEffect(() => {
    const prompts = promptPacksData?.prompts ?? [];
    if (prompts.length === 0) {
      setSelectedPromptId(null);
      setPromptDraft("");
      return;
    }
    const next = prompts.find((prompt) => prompt.id === selectedPromptId) ?? prompts[0];
    if (next.id !== selectedPromptId) setSelectedPromptId(next.id);
    setPromptDraft(next.content ?? "");
  }, [promptPacksData, selectedPromptId]);

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

      <SettingsCard
        title={isZh ? "提示词" : "Prompt packs"}
        description={isZh ? "集中查看和调整内置提示词。修改会保存为项目级覆盖文件，不会改动内置默认值。" : "Review and tune built-in prompt packs. Edits are saved as project overrides without changing the defaults."}
        icon={<FileText size={18} />}
      >
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
            {promptGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                {isZh ? "没有可编辑提示词。" : "No prompt packs available."}
              </p>
            ) : (
              <div className="space-y-4">
                {promptGroups.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{group.title}</div>
                      {group.description ? (
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground/80">{group.description}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      {group.prompts.map((prompt) => (
                        <button
                          key={prompt.id}
                          type="button"
                          onClick={() => {
                            setSelectedPromptId(prompt.id);
                            setPromptDraft(prompt.content ?? "");
                          }}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                            selectedPromptId === prompt.id
                              ? "border-primary/50 bg-primary/10 text-primary"
                              : "border-border/50 bg-background/40 text-foreground hover:border-primary/30 hover:bg-primary/5"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">{prompt.title}</span>
                            {prompt.overridden ? (
                              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                                {isZh ? "已改" : "custom"}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/75">{prompt.id}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
            {selectedPrompt ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-bold">{selectedPrompt.title}</div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">{selectedPrompt.id}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {isZh ? "当前来源" : "Source"}: {selectedPrompt.source}
                      {selectedPrompt.path ? ` · ${selectedPrompt.path}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => runSave(`reset-prompt:${selectedPrompt.id}`, async () => {
                        await fetchJson(`/prompt-packs/${encodeURIComponent(selectedPrompt.id)}`, { method: "DELETE" });
                        await refetchPromptPacks();
                      }, isZh ? "提示词已恢复默认" : "Prompt reset to default")}
                      disabled={saving === `reset-prompt:${selectedPrompt.id}` || !selectedPrompt.overridden}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${c.btnSecondary} disabled:opacity-40`}
                    >
                      <RotateCcw size={14} />
                      {isZh ? "恢复默认" : "Reset"}
                    </button>
                    <button
                      type="button"
                      onClick={() => runSave(`prompt:${selectedPrompt.id}`, async () => {
                        await putApi(`/prompt-packs/${encodeURIComponent(selectedPrompt.id)}`, { content: promptDraft });
                        await refetchPromptPacks();
                      }, isZh ? "提示词已保存" : "Prompt saved")}
                      disabled={saving === `prompt:${selectedPrompt.id}` || !promptDirty}
                      className={`rounded-lg px-4 py-2 text-sm font-bold ${c.btnPrimary} disabled:opacity-40`}
                    >
                      {saving === `prompt:${selectedPrompt.id}` ? t("config.saving") : t("config.save")}
                    </button>
                  </div>
                </div>

                <textarea
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  className={`${fieldClass} min-h-[260px] resize-y font-mono leading-6`}
                />

                <details className="rounded-xl border border-border/50 bg-background/50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
                    {isZh ? "查看内置默认" : "View built-in default"}
                  </summary>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-secondary/30 p-3 text-xs leading-5 text-muted-foreground">
                    {selectedPrompt.defaultContent ?? ""}
                  </pre>
                </details>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isZh ? "选择左侧提示词后编辑。" : "Select a prompt on the left to edit it."}
              </p>
            )}
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
