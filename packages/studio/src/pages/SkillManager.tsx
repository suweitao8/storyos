import { useState } from "react";
import { Bot, List, Plus, Trash2 } from "lucide-react";
import { fetchJson, postApi, putApi, useApi } from "../hooks/use-api";
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

type NoticeTone = "success" | "error" | "info";

interface SkillsResponse {
  readonly skills: ReadonlyArray<StudioSkill>;
  readonly diagnostics?: ReadonlyArray<{ readonly path?: string; readonly message?: string }>;
}

const fieldClass = "w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-primary/50";

export function SkillManager({ theme, lang, t }: {
  theme: Theme;
  lang: "zh" | "en";
  t: TFunction;
}) {
  const c = useColors(theme);
  const isZh = lang === "zh";
  const { data: skillsData, refetch: refetchSkills } = useApi<SkillsResponse>("/skills");
  const [tab, setTab] = useState<"list" | "create">("list");
  const [skillDraft, setSkillDraft] = useState<SkillDraft>(() => createEmptySkillDraft());
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
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

  const openCreate = () => {
    setEditingSkillId(null);
    setSkillDraft(createEmptySkillDraft());
    setTab("create");
  };

  const openEdit = (skill: StudioSkill) => {
    setEditingSkillId(skill.id);
    setSkillDraft(skillDraftFromSkill(skill));
    setTab("create");
  };

  usePageToolbar("skills", {
    tabs: [
      { id: "list", label: isZh ? "Skill 列表" : "Skills", icon: <List size={14} /> },
      { id: "create", label: editingSkillId ? (isZh ? "编辑" : "Edit") : (isZh ? "新建" : "Create"), icon: <Plus size={14} /> },
    ],
    activeTab: tab,
    onTabChange: (next) => {
      if (next === "list") setTab("list");
      else openCreate();
    },
  });

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6">
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

      {tab === "list" && (
        <div className="space-y-4">
          {skills.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border/60 text-center">
              <div className="space-y-3">
                <Bot size={32} className="mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {isZh ? "还没有 Skill，点击「新建」创建第一个。" : "No skills yet. Click \"Create\" to add one."}
                </p>
                <button
                  onClick={openCreate}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold ${c.btnPrimary}`}
                >
                  <Plus size={14} /> {isZh ? "新建 Skill" : "New skill"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {skills.map((skill) => (
                <div key={skill.id} className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary"><Bot size={18} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-bold">{skill.name}</div>
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
                          onClick={() => openEdit(skill)}
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
        </div>
      )}

      {tab === "create" && (
        <div className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold">
                {editingSkillId ? (isZh ? "编辑 Skill" : "Edit skill") : (isZh ? "新建 Skill" : "New skill")}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {isZh ? "保存到 .inkos/skills/<id>/SKILL.md" : "Saved to .inkos/skills/<id>/SKILL.md"}
              </p>
            </div>
            {editingSkillId ? (
              <button
                type="button"
                onClick={() => { setEditingSkillId(null); setSkillDraft(createEmptySkillDraft()); }}
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
              placeholder={isZh ? "关联提示词包，如 longform.writer" : "Prompt packs, e.g. longform.writer"}
              className={`${fieldClass} md:col-span-2 font-mono`}
            />
            <textarea
              value={skillDraft.body}
              onChange={(e) => setSkillDraft((draft) => ({ ...draft, body: e.target.value }))}
              placeholder={isZh ? "写给模型的专业能力说明..." : "Instructions for the model..."}
              rows={8}
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
                setTab("list");
              }, isZh ? "Skill 已保存" : "Skill saved")}
              disabled={saving === "skill" || !skillDraft.body.trim() || !skillDraftToPayload(skillDraft).id}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${c.btnPrimary} disabled:opacity-40`}
            >
              {saving === "skill" ? t("config.saving") : t("config.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
