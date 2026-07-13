import { useState } from "react";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useI18n } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { useApi } from "../hooks/use-api";
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

interface VoiceGroupOption {
  readonly key: string;
  readonly label: string;
  readonly labelEn: string;
}

interface ApiResponse {
  readonly imageTemplates: Record<string, string>;
  readonly imageStyles: Record<ArtStyleKey, Record<string, string>>;
  readonly voice: Record<string, string>;
  readonly artStyles: ReadonlyArray<ArtStyleOption>;
  readonly voiceGroups: ReadonlyArray<VoiceGroupOption>;
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
  const { data, loading, error } = useApi<ApiResponse>("/project/prompt-templates");
  const { data: promptPacksData } = useApi<PromptPacksResponse>("/prompt-packs");

  const [tab, setTab] = useState<FormTab>("imageTemplates");
  const [writingMode, setWritingMode] = useState<WritingMode>("longform");

  const tabBtn = (key: FormTab, label: string) =>
    `px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors whitespace-nowrap ${
      tab === key
        ? "border-primary text-primary font-medium"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  const imageKinds = data ? Object.keys(data.imageTemplates) : [];
  // Only show the longform / short-fiction prompt packs; play /
  // interactive-film packs are not surfaced in the UI.
  const HIDDEN_PACK_IDS = new Set(["play", "interactive-film"]);
  const allWritingGroups = groupPromptPacksForDisplay(promptPacksData ?? { packs: [], prompts: [] }).filter(
    (group) => !HIDDEN_PACK_IDS.has(group.id),
  );
  const writingGroups = allWritingGroups.filter((group) => group.id === writingMode);

  return (
    <div className="space-y-5">
      <div className={`border ${c.cardStatic} rounded-xl p-6 space-y-5`}>
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-medium">{lang === "zh" ? "提示词模板" : "Prompt Templates"}</h1>
          <p className="text-xs text-muted-foreground/70">
            {lang === "zh"
              ? "预览写作、图片和语音相关的内置提示词。如需修改请前往设置页面。"
              : "Preview built-in writing, image, and voice prompts. To modify, go to Settings."}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 size={20} className="animate-spin mr-2" />
            {lang === "zh" ? "加载中…" : "Loading…"}
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">{error}</div>
        ) : !data ? null : (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-border overflow-x-auto">
              <button className={tabBtn("imageTemplates", t("genre.tabImage"))} onClick={() => setTab("imageTemplates")}>
                {t("genre.tabImage")}
              </button>
              <button className={tabBtn("imageStyles", t("genre.tabStyle"))} onClick={() => setTab("imageStyles")}>
                {t("genre.tabStyle")}
              </button>
              <button className={tabBtn("voice", t("genre.tabVoice"))} onClick={() => setTab("voice")}>
                {t("genre.tabVoice")}
              </button>
              <button className={tabBtn("writing", t("genre.tabWriting"))} onClick={() => setTab("writing")}>
                {t("genre.tabWriting")}
              </button>
            </div>

            {tab === "writing" && (
              <div className="space-y-6">
                {/* Sub-toggle: longform vs short-fiction */}
                <div className="flex items-center gap-1">
                  {(["longform", "short-fiction"] as const).map((mode) => {
                    const label = mode === "longform"
                      ? (lang === "zh" ? "长篇故事" : "Long-form")
                      : (lang === "zh" ? "短篇故事" : "Short Story");
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
                <p className="text-xs text-muted-foreground">
                  {writingMode === "longform"
                    ? (lang === "zh"
                        ? "长篇故事的写作、修订、审计等环节的内置指导提示词。"
                        : "Built-in guidance prompts for long-form writing, revising, and auditing.")
                    : (lang === "zh"
                        ? "短篇故事的大纲、写作、审稿、包装等环节的内置指导提示词。"
                        : "Built-in guidance prompts for short-story outline, writing, review, and packaging.")}
                </p>
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
                                {lang === "zh" ? "已改" : "custom"}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground/75">{prompt.id}</div>
                          <pre className="mt-1 w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-foreground/80 whitespace-pre-wrap max-h-[320px] overflow-y-auto">
                            {prompt.content || `（${lang === "zh" ? "空" : "empty"}）`}
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
                <p className="text-xs text-muted-foreground">
                  {lang === "zh"
                    ? "风格无关的内容提取模板，生成时会与画面风格描述拼接。"
                    : "Style-agnostic content extraction templates, combined with art style descriptions at generation time."}
                </p>
                {imageKinds.map((kind) => {
                  const labels = IMAGE_LABELS[kind] ?? { zh: kind, en: kind };
                  const value = data.imageTemplates[kind] ?? "";
                  return (
                    <div key={kind}>
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {lang === "zh" ? labels.zh : labels.en}
                      </label>
                      <pre className="mt-1 w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-foreground/80 whitespace-pre-wrap max-h-[320px] overflow-y-auto">
                        {value || `（${lang === "zh" ? "空" : "empty"}）`}
                      </pre>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "imageStyles" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {lang === "zh"
                    ? "画面风格描述，按角色/场景/道具分别配置，生成时追加到对应模板末尾。"
                    : "Art style descriptions per character/scene/prop, appended to the corresponding template at generation time."}
                </p>
                {data.artStyles.map((style) => {
                  const styleKinds = data.imageStyles[style.key] ?? {};
                  return (
                    <div key={style.key} className="space-y-2">
                      <div className="text-sm font-medium text-primary">
                        {lang === "zh" ? style.label : style.labelEn}
                      </div>
                      {Object.entries(styleKinds).map(([kind, value]) => {
                        const labels = IMAGE_LABELS[kind] ?? { zh: kind, en: kind };
                        return (
                          <div key={kind}>
                            <label className="text-xs text-muted-foreground uppercase tracking-wide">
                              {lang === "zh" ? labels.zh : labels.en}
                            </label>
                            <pre className="mt-1 w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-foreground/80 whitespace-pre-wrap max-h-[160px] overflow-y-auto">
                              {value || `（${lang === "zh" ? "空" : "empty"}）`}
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
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.voiceGroups.map((group) => (
                    <div key={group.key}>
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {lang === "zh" ? group.label : group.labelEn}
                      </label>
                      <pre className="mt-1 w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-foreground/80 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                        {data.voice[group.key] || `（${lang === "zh" ? "空" : "empty"}）`}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
