import { useState } from "react";
import { Bot, Trash2 } from "lucide-react";
import { fetchJson, putApi, useApi } from "../hooks/use-api";
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
  const [tab, setTab] = useState<"list" | "edit">("list");
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

  const openEdit = (skill: StudioSkill) => {
    setEditingSkillId(skill.id);
    setSkillDraft(skillDraftFromSkill(skill));
    setTab("edit");
  };

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
                  {isZh ? "暂无可用 Skill。" : "No skills available."}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">{isZh ? "名称" : "Name"}</th>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">{isZh ? "来源" : "Source"}</th>
                    <th className="px-4 py-3 font-medium">{isZh ? "用途" : "Usage"}</th>
                    <th className="px-4 py-3 text-right font-medium">{isZh ? "操作" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {skills.map((skill) => (
                    <tr key={skill.id} className="align-top hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{skill.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">@{skill.id}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{skill.source ?? "skill"}</td>
                      <td className="max-w-[360px] px-4 py-3 text-xs leading-5 text-muted-foreground">
                        {skill.whenToUse || skill.description || (isZh ? "无说明" : "No description")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {skill.editable ? (
                          <div className="flex justify-end gap-1">
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
                                  setTab("list");
                                }
                                await refetchSkills();
                              }, isZh ? "Skill 已删除" : "Skill deleted")}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                              aria-label={isZh ? `删除 ${skill.name}` : `Delete ${skill.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{isZh ? "内置" : "Built-in"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "edit" && editingSkillId && (
        <div className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold">
                {isZh ? "编辑 Skill" : "Edit skill"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {isZh ? "保存到 .storyos/skills/<id>/SKILL.md" : "Saved to .storyos/skills/<id>/SKILL.md"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setEditingSkillId(null); setSkillDraft(createEmptySkillDraft()); setTab("list"); }}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary"
            >
              {isZh ? "取消编辑" : "Cancel"}
            </button>
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
                const payload = skillDraftToPayload(skillDraft, false);
                await putApi(`/skills/${encodeURIComponent(editingSkillId)}`, payload);
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
