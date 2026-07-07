import { useState } from "react";
import { fetchJson, useApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { Wand2, BookOpen, Trash2, ChevronDown, ChevronRight } from "lucide-react";

interface CraftMeta {
  readonly id: string;
  readonly sourceName: string;
  readonly createdAt: string;
  readonly language: "zh" | "en";
}

interface CraftExemplar {
  readonly label: string;
  readonly tone: string;
  readonly excerpt: string;
}

interface CraftProfile {
  readonly sourceName: string;
  readonly analyzedAt: string;
  readonly language: "zh" | "en";
  readonly structure: {
    readonly openingPattern: string;
    readonly chapterArc: string;
    readonly endingHookType: string;
    readonly exemplar?: string;
  };
  readonly sceneRhythm: {
    readonly sceneTransitionTechnique: string;
    readonly pacingCurve: string;
    readonly conflictEscalation: string;
    readonly exemplar?: string;
  };
  readonly informationDisclosure: {
    readonly foreshadowingDensity: string;
    readonly informationReleaseRhythm: string;
    readonly suspenseManagement: string;
    readonly exemplar?: string;
  };
  readonly narrativePerspective: {
    readonly povStrategy: string;
    readonly narrationDialogueRatio: string;
    readonly narrativeDistance: string;
    readonly exemplar?: string;
  };
  readonly exemplars: ReadonlyArray<CraftExemplar>;
}

interface Nav { toDashboard: () => void }

export function CraftManager({ nav, theme, t }: { nav: Nav; theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const [text, setText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [language, setLanguage] = useState<"zh" | "en">("zh");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, CraftProfile>>({});

  const { data: craftsData, refetch } = useApi<{ crafts: ReadonlyArray<CraftMeta> }>("/crafts");

  const handleAnalyze = async () => {
    if (!text.trim() || !sourceName.trim()) return;
    setLoading(true);
    setStatus("...");
    try {
      await fetchJson<{ craftId: string }>("/craft/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sourceName, language }),
      });
      setStatus("");
      setText("");
      setSourceName("");
      await refetch();
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading(false);
  };

  const handleDelete = async (craftId: string) => {
    try {
      await fetchJson(`/crafts/${craftId}`, { method: "DELETE" });
      await refetch();
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const toggleExpand = async (craftId: string) => {
    if (expandedId === craftId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(craftId);
    if (!detailCache[craftId]) {
      try {
        const profile = await fetchJson<CraftProfile>(`/crafts/${craftId}`, { method: "GET" });
        setDetailCache((prev) => ({ ...prev, [craftId]: profile }));
      } catch {
        // ignore
      }
    }
  };

  const crafts = craftsData?.crafts ?? [];

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl flex items-center gap-3">
        <Wand2 size={28} className="text-primary" />
        {t("craft.title")}
      </h1>

      {status && (
        <div className={`px-4 py-2 rounded-lg text-sm ${
          status.startsWith("Error:") ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        }`}>
          {status}
        </div>
      )}

      {/* Input */}
      <div className={`border ${c.cardStatic} rounded-lg p-5 space-y-4`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">{t("craft.sourceName")}</label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder={t("craft.sourceExample")}
              className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">{t("craft.language")}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "zh" | "en")}
              className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border text-sm focus:outline-none focus:border-primary"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">{t("craft.textSample")}</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={t("craft.pasteHint")}
            className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border text-sm focus:outline-none focus:border-primary resize-none font-mono"
          />
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!text.trim() || !sourceName.trim() || loading}
          className={`px-4 py-2 text-sm rounded-lg ${c.btnPrimary} disabled:opacity-30 flex items-center gap-2`}
        >
          <BookOpen size={14} />
          {loading ? t("craft.analyzing") : t("craft.analyze")}
        </button>
      </div>

      {/* Saved craft profiles */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{t("craft.results")}</h3>
        {crafts.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("craft.emptyHint")}</p>
        )}
        {crafts.map((craft) => {
          const expanded = expandedId === craft.id;
          const detail = detailCache[craft.id];
          return (
            <div key={craft.id} className={`border ${c.cardStatic} rounded-lg overflow-hidden`}>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-secondary/20"
                onClick={() => toggleExpand(craft.id)}
              >
                <div className="flex items-center gap-2">
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="font-medium text-sm">{craft.sourceName}</span>
                  <span className="text-xs text-muted-foreground">{craft.language}</span>
                  <span className="text-xs text-muted-foreground">{new Date(craft.createdAt).toLocaleDateString()}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(craft.id); }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {expanded && detail && (
                <div className="px-4 pb-4 space-y-4 border-t border-border">
                  <CraftSection title={t("craft.structure")} fields={[
                    ["开篇模式 / Opening", detail.structure.openingPattern],
                    ["单章弧线 / Arc", detail.structure.chapterArc],
                    ["章末钩子 / Hook", detail.structure.endingHookType],
                  ]} exemplar={detail.structure.exemplar} />
                  <CraftSection title={t("craft.sceneRhythm")} fields={[
                    ["场景切换 / Transition", detail.sceneRhythm.sceneTransitionTechnique],
                    ["节奏曲线 / Pacing", detail.sceneRhythm.pacingCurve],
                    ["冲突升级 / Escalation", detail.sceneRhythm.conflictEscalation],
                  ]} exemplar={detail.sceneRhythm.exemplar} />
                  <CraftSection title={t("craft.infoDisclosure")} fields={[
                    ["伏笔密度 / Foreshadowing", detail.informationDisclosure.foreshadowingDensity],
                    ["信息释放 / Release", detail.informationDisclosure.informationReleaseRhythm],
                    ["悬念管理 / Suspense", detail.informationDisclosure.suspenseManagement],
                  ]} exemplar={detail.informationDisclosure.exemplar} />
                  <CraftSection title={t("craft.narrativePOV")} fields={[
                    ["POV 策略 / Strategy", detail.narrativePerspective.povStrategy],
                    ["叙述/对话比例 / Ratio", detail.narrativePerspective.narrationDialogueRatio],
                    ["叙事距离 / Distance", detail.narrativePerspective.narrativeDistance],
                  ]} exemplar={detail.narrativePerspective.exemplar} />

                  {detail.exemplars.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{t("craft.exemplars")}</h4>
                      <div className="space-y-2">
                        {detail.exemplars.map((ex, i) => (
                          <div key={i} className="bg-secondary/20 rounded-lg p-3">
                            <div className="text-xs font-medium mb-1">{ex.label}（{ex.tone}）</div>
                            <div className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{ex.excerpt}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CraftSection({ title, fields, exemplar }: {
  title: string;
  fields: ReadonlyArray<[string, string]>;
  exemplar?: string;
}) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
      <div className="space-y-1">
        {fields.map(([label, value]) => (
          <div key={label} className="text-sm flex gap-2">
            <span className="text-muted-foreground min-w-fit">{label}:</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
      {exemplar && (
        <div className="mt-2 bg-secondary/20 rounded-lg p-3">
          <div className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{exemplar}</div>
        </div>
      )}
    </div>
  );
}
