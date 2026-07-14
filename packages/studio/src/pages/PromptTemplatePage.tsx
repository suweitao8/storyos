import { useState } from "react";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useI18n } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { useApi } from "../hooks/use-api";
import { usePageToolbar } from "../components/PageToolbar";
import { Loader2 } from "lucide-react";
import {
  groupPromptPacksForDisplay,
  type PromptPacksResponse,
} from "./prompt-pack-ui-state";

// ---------------------------------------------------------------------------
// Types — mirror the read-only shape returned by the API
// ---------------------------------------------------------------------------

type ArtStyleKey = "realistic" | "cg3d";

interface ArtStyleOption {
  readonly key: ArtStyleKey;
  readonly label: string;
  readonly labelEn: string;
}

interface ApiResponse {
  readonly imageTemplates: Record<string, string>;
  readonly imageStyles: Record<ArtStyleKey, Record<string, string>>;
  readonly voice: string;
  readonly artStyles: ReadonlyArray<ArtStyleOption>;
}

type FormTab = "writing" | "imageTemplates" | "imageStyles" | "voice";
type WritingMode = "longform" | "short-fiction";

const IMAGE_LABELS: Record<string, { zh: string; en: string }> = {
  character: { zh: "角色图片提示词", en: "Character Image Prompt" },
  scene: { zh: "场景图片提示词", en: "Scene Image Prompt" },
  prop: { zh: "道具图片提示词", en: "Prop Image Prompt" },
};

export function PromptTemplatePage({ theme, t }: { theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const { lang } = useI18n();
  const isZh = lang === "zh";
  const { data, loading, error } = useApi<ApiResponse>("/project/prompt-templates");
  const { data: promptPacksData } = useApi<PromptPacksResponse>("/prompt-packs");

  const [tab, setTab] = useState<FormTab>("imageTemplates");
  const [writingMode, setWritingMode] = useState<WritingMode>("longform");

  usePageToolbar("prompt-templates", {
    tabs: [
      { id: "imageTemplates", label: t("genre.tabImage") },
      { id: "imageStyles", label: t("genre.tabStyle") },
      { id: "voice", label: t("genre.tabVoice") },
      { id: "writing", label: t("genre.tabWriting") },
    ],
    activeTab: tab,
    onTabChange: (next) => setTab(next as FormTab),
  });

  const imageKinds = data ? Object.keys(data.imageTemplates) : [];
  // Only show the longform / short-fiction prompt packs; play /
  // interactive-film packs are not surfaced in the UI.
  const HIDDEN_PACK_IDS = new Set(["play", "interactive-film"]);
  const allWritingGroups = groupPromptPacksForDisplay(promptPacksData ?? { packs: [], prompts: [] }).filter(
    (group) => !HIDDEN_PACK_IDS.has(group.id),
  );
  const writingGroups = allWritingGroups.filter((group) => group.id === writingMode);

  return (
    <div className={`mx-auto w-full max-w-[1000px] space-y-5`}>
      <div className={`border ${c.cardStatic} rounded-xl p-6 space-y-5`}>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 size={20} className="animate-spin mr-2" />
            {isZh ? "加载中…" : "Loading…"}
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">{error}</div>
        ) : !data ? null : (
          <>
            {tab === "writing" && (
              <div className="space-y-6">
                {/* Sub-toggle: longform vs short-fiction */}
                <div className="flex items-center gap-1">
                  {(["longform", "short-fiction"] as const).map((mode) => {
                    const label = mode === "longform"
                      ? (isZh ? "长篇故事" : "Long-form")
                      : (isZh ? "短篇故事" : "Short Story");
                    return (
                      <button
                        key={mode}
                        onClick={() => setWritingMode(mode)}
                        className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                          writingMode === mode
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {writingGroups.map((group) => (
                  <div key={group.id} className="space-y-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{group.title}</div>
                      {group.description ? (
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground/80">{group.description}</p>
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      {group.prompts.map((prompt) => (
                        <div key={prompt.id}>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-foreground/90">{prompt.title}</label>
                            {prompt.overridden ? (
                              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                                {isZh ? "已改" : "custom"}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground/75">{prompt.id}</div>
                          <pre className="mt-1 w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-foreground/80 whitespace-pre-wrap max-h-[320px] overflow-y-auto">
                            {prompt.content || `（${isZh ? "空" : "empty"}）`}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "imageTemplates" && (
              <div className="space-y-4">
                {imageKinds.map((kind) => {
                  const labels = IMAGE_LABELS[kind] ?? { zh: kind, en: kind };
                  const value = data.imageTemplates[kind] ?? "";
                  return (
                    <div key={kind}>
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {isZh ? labels.zh : labels.en}
                      </label>
                      <pre className="mt-1 w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-foreground/80 whitespace-pre-wrap max-h-[320px] overflow-y-auto">
                        {value || `（${isZh ? "空" : "empty"}）`}
                      </pre>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "imageStyles" && (
              <div className="space-y-4">
                {data.artStyles.map((style) => {
                  const styleKinds = data.imageStyles[style.key] ?? {};
                  return (
                    <div key={style.key} className="space-y-2">
                      <div className="text-sm font-medium text-primary">
                        {isZh ? style.label : style.labelEn}
                      </div>
                      {Object.entries(styleKinds).map(([kind, value]) => {
                        const labels = IMAGE_LABELS[kind] ?? { zh: kind, en: kind };
                        return (
                          <div key={kind}>
                            <label className="text-xs text-muted-foreground uppercase tracking-wide">
                              {isZh ? labels.zh : labels.en}
                            </label>
                            <pre className="mt-1 w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-foreground/80 whitespace-pre-wrap max-h-[160px] overflow-y-auto">
                              {value || `（${isZh ? "空" : "empty"}）`}
                            </pre>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "voice" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                    {isZh ? "语音提示词模板" : "Voice Prompt Template"}
                  </label>
                  <pre className="mt-1 w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-foreground/80 whitespace-pre-wrap max-h-[420px] overflow-y-auto">
                    {data.voice || `（${isZh ? "空" : "empty"}）`}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
