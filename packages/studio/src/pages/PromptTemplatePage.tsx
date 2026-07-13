import { useState } from "react";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useI18n } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { useApi } from "../hooks/use-api";
import { Loader2 } from "lucide-react";

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
  readonly imageStyles: Record<ArtStyleKey, string>;
  readonly voice: Record<string, string>;
  readonly artStyles: ReadonlyArray<ArtStyleOption>;
  readonly voiceGroups: ReadonlyArray<VoiceGroupOption>;
}

type FormTab = "imageTemplates" | "imageStyles" | "voice";

const IMAGE_LABELS: Record<string, { zh: string; en: string }> = {
  character: { zh: "角色图片提示词", en: "Character Image Prompt" },
  scene: { zh: "场景图片提示词", en: "Scene Image Prompt" },
  prop: { zh: "道具图片提示词", en: "Prop Image Prompt" },
};

export function PromptTemplatePage({ theme, t }: { theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const { lang } = useI18n();
  const { data, loading, error } = useApi<ApiResponse>("/project/prompt-templates");

  const [tab, setTab] = useState<FormTab>("imageTemplates");

  const tabBtn = (key: FormTab, label: string) =>
    `px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors whitespace-nowrap ${
      tab === key
        ? "border-primary text-primary font-medium"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  const imageKinds = data ? Object.keys(data.imageTemplates) : [];

  return (
    <div className="space-y-5">
      <div className={`border ${c.cardStatic} rounded-xl p-6 space-y-5`}>
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-medium">{lang === "zh" ? "提示词模板" : "Prompt Templates"}</h1>
          <p className="text-xs text-muted-foreground/70">
            {lang === "zh"
              ? "以下是内置的图片模板、画面风格和语音提示词，仅供预览。如需修改请在题材管理中编辑。"
              : "Built-in image templates, art styles, and voice prompts, read-only. To modify, edit in Genre Manager."}
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
            </div>

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
                    ? "画面风格描述，生成时追加到图片模板末尾。"
                    : "Art style descriptions, appended to image templates at generation time."}
                </p>
                {data.artStyles.map((style) => {
                  const value = data.imageStyles[style.key] ?? "";
                  return (
                    <div key={style.key}>
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {lang === "zh" ? style.label : style.labelEn}
                      </label>
                      <pre className="mt-1 w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-foreground/80 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                        {value || `（${lang === "zh" ? "空" : "empty"}）`}
                      </pre>
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
