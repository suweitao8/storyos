import { useState, useEffect } from "react";
import type { Theme } from "../hooks/use-theme";
import type { TFunction, StringKey } from "../hooks/use-i18n";
import { useI18n } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { useApi, fetchJson } from "../hooks/use-api";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the global prompt templates (mirrors core PromptTemplates). */
interface PromptTemplatesData {
  readonly image: { readonly character: string; readonly scene: string; readonly prop: string };
  readonly voice: {
    readonly boy: string;
    readonly girl: string;
    readonly youngMale: string;
    readonly youngFemale: string;
    readonly middleMale: string;
    readonly middleFemale: string;
    readonly elderMale: string;
    readonly elderFemale: string;
  };
}

type VoiceFieldKey = keyof PromptTemplatesData["voice"];
type ImageFieldKey = keyof PromptTemplatesData["image"];

const IMAGE_FIELDS: ReadonlyArray<{ key: ImageFieldKey; labelKey: StringKey }> = [
  { key: "character", labelKey: "genre.imageCharacter" },
  { key: "scene", labelKey: "genre.imageScene" },
  { key: "prop", labelKey: "genre.imageProp" },
];

const VOICE_FIELDS: ReadonlyArray<{ key: VoiceFieldKey; labelKey: StringKey }> = [
  { key: "boy", labelKey: "genre.voiceBoy" },
  { key: "girl", labelKey: "genre.voiceGirl" },
  { key: "youngMale", labelKey: "genre.voiceYoungMale" },
  { key: "youngFemale", labelKey: "genre.voiceYoungFemale" },
  { key: "middleMale", labelKey: "genre.voiceMiddleMale" },
  { key: "middleFemale", labelKey: "genre.voiceMiddleFemale" },
  { key: "elderMale", labelKey: "genre.voiceElderMale" },
  { key: "elderFemale", labelKey: "genre.voiceElderFemale" },
];

const EMPTY_TEMPLATES: PromptTemplatesData = {
  image: { character: "", scene: "", prop: "" },
  voice: {
    boy: "", girl: "", youngMale: "", youngFemale: "",
    middleMale: "", middleFemale: "", elderMale: "", elderFemale: "",
  },
};

/** Merge partial data from the API into a complete PromptTemplatesData. */
function normalizeTemplates(raw: unknown): PromptTemplatesData {
  if (!raw || typeof raw !== "object") return EMPTY_TEMPLATES;
  const obj = raw as Record<string, unknown>;
  const imageRaw = (obj.image ?? {}) as Record<string, unknown>;
  const voiceRaw = (obj.voice ?? {}) as Record<string, unknown>;
  return {
    image: {
      character: typeof imageRaw.character === "string" ? imageRaw.character : "",
      scene: typeof imageRaw.scene === "string" ? imageRaw.scene : "",
      prop: typeof imageRaw.prop === "string" ? imageRaw.prop : "",
    },
    voice: {
      boy: typeof voiceRaw.boy === "string" ? voiceRaw.boy : "",
      girl: typeof voiceRaw.girl === "string" ? voiceRaw.girl : "",
      youngMale: typeof voiceRaw.youngMale === "string" ? voiceRaw.youngMale : "",
      youngFemale: typeof voiceRaw.youngFemale === "string" ? voiceRaw.youngFemale : "",
      middleMale: typeof voiceRaw.middleMale === "string" ? voiceRaw.middleMale : "",
      middleFemale: typeof voiceRaw.middleFemale === "string" ? voiceRaw.middleFemale : "",
      elderMale: typeof voiceRaw.elderMale === "string" ? voiceRaw.elderMale : "",
      elderFemale: typeof voiceRaw.elderFemale === "string" ? voiceRaw.elderFemale : "",
    },
  };
}

type FormTab = "image" | "voice";

export function PromptTemplatePage({ theme, t }: { theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const { lang } = useI18n();
  const { data, loading, error, refetch } = useApi<{ promptTemplates: unknown }>("/project/prompt-templates");

  const [tab, setTab] = useState<FormTab>("image");
  const [form, setForm] = useState<PromptTemplatesData>(EMPTY_TEMPLATES);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  // Load remote data into the editable form once.
  useEffect(() => {
    if (loaded || !data) return;
    setForm(normalizeTemplates(data.promptTemplates));
    setLoaded(true);
  }, [data, loaded]);

  const setImage = (key: ImageFieldKey, value: string) =>
    setForm((prev) => ({ ...prev, image: { ...prev.image, [key]: value } }));
  const setVoice = (key: VoiceFieldKey, value: string) =>
    setForm((prev) => ({ ...prev, voice: { ...prev.voice, [key]: value } }));

  const handleSave = async () => {
    setSaving(true);
    setStatus("idle");
    setMessage("");
    try {
      await fetchJson("/project/prompt-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptTemplates: form }),
      });
      setStatus("saved");
      await refetch();
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const tabBtn = (key: FormTab, label: string) =>
    `px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors ${
      tab === key
        ? "border-primary text-primary font-medium"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="space-y-5">
      <div className={`border ${c.cardStatic} rounded-xl p-6 space-y-5`}>
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-medium">{lang === "zh" ? "提示词模板" : "Prompt Templates"}</h1>
          <p className="text-xs text-muted-foreground/70">
            {t("promptTemplates.hint")}
          </p>
        </div>

        {loading && !loaded ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 size={20} className="animate-spin mr-2" />
            {lang === "zh" ? "加载中…" : "Loading…"}
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">{error}</div>
        ) : (
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
                <p className="text-xs text-muted-foreground">{t("genre.templateHint")}</p>
                {IMAGE_FIELDS.map(({ key, labelKey }) => (
                  <div key={key}>
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">{t(labelKey)}</label>
                    <textarea
                      value={form.image[key]}
                      onChange={(e) => setImage(key, e.target.value)}
                      rows={8}
                      placeholder={t("genre.templateHint")}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                    />
                  </div>
                ))}
              </div>
            )}

            {tab === "voice" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{t("genre.templateHint")}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {VOICE_FIELDS.map(({ key, labelKey }) => (
                    <div key={key}>
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">{t(labelKey)}</label>
                      <textarea
                        value={form.voice[key]}
                        onChange={(e) => setVoice(key, e.target.value)}
                        rows={5}
                        placeholder={t("genre.templateHint")}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/40">
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm ${c.btnPrimary} disabled:opacity-50`}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {t("common.save")}
              </button>
              {status === "saved" && (
                <span className="text-xs text-emerald-500">{t("genre.saveChanges")} ✓</span>
              )}
              {status === "error" && (
                <span className="text-xs text-destructive">{message}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
