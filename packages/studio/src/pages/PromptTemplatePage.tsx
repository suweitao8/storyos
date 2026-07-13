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
  readonly image: Record<string, Record<ArtStyleKey, string>>;
  readonly voice: Record<string, string>;
  readonly artStyles: ReadonlyArray<ArtStyleOption>;
  readonly voiceGroups: ReadonlyArray<VoiceGroupOption>;
}

type FormTab = "image" | "voice";

const IMAGE_LABELS: Record<string, { zh: string; en: string }> = {
  character: { zh: "角色图片提示词", en: "Character Image Prompt" },
  scene: { zh: "场景图片提示词", en: "Scene Image Prompt" },
  prop: { zh: "道具图片提示词", en: "Prop Image Prompt" },
};

export function PromptTemplatePage({ theme, t }: { theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const { lang } = useI18n();
  const { data, loading, error } = useApi<ApiResponse>("/project/prompt-templates");

  const [tab, setTab] = useState<FormTab>("image");
  const [artStyle, setArtStyle] = useState<ArtStyleKey>("realistic");

  const tabBtn = (key: FormTab, label: string) =>
    `px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors ${
      tab === key
        ? "border-primary text-primary font-medium"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  const imageKinds = data ? Object.keys(data.image) : [];

  return (
    <div className="space-y-5">
      <div className={`border ${c.cardStatic} rounded-xl p-6 space-y-5`}>
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-medium">{lang === "zh" ? "提示词模板" : "Prompt Templates"}</h1>
          <p className="text-xs text-muted-foreground/70">
            {lang === "zh"
              ? "以下是内置的图片和语音提示词模板，仅供预览。如需修改请通过对话调整。"
              : "Built-in image and voice prompt templates, read-only. To modify, adjust via conversation."}
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
            <div className="flex gap-1 border-b border-border">
              <button className={tabBtn("image", t("genre.tabImage"))} onClick={() => setTab("image")}>
                {t("genre.tabImage")}
              </button>
              <button className={tabBtn("voice", t("genre.tabVoice"))} onClick={() => setTab("voice")}>
                {t("genre.tabVoice")}
              </button>
            </div>

            {tab === "image" && (
              <div className="space-y-4">
                {/* Art style selector */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {lang === "zh" ? "画风" : "Art Style"}
                  </span>
                  <div className="flex gap-1">
                    {data.artStyles.map((style) => (
                      <button
                        key={style.key}
                        onClick={() => setArtStyle(style.key)}
                        className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                          artStyle === style.key
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {lang === "zh" ? style.label : style.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image prompts (read-only) */}
                {imageKinds.map((kind) => {
                  const labels = IMAGE_LABELS[kind] ?? { zh: kind, en: kind };
                  const promptGroup = data.image[kind];
                  const value = promptGroup?.[artStyle] ?? "";
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
