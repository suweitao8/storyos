import { fetchJson, useApi, postApi } from "../hooks/use-api";
import { useState } from "react";
import type { Theme } from "../hooks/use-theme";
import type { TFunction, StringKey } from "../hooks/use-i18n";
import { useI18n } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { filterGenresForLanguage } from "./genre-page-state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ArtStyle = "realistic" | "cg3d";

interface GenreInfo {
  readonly id: string;
  readonly name: string;
  readonly source: "project" | "builtin";
  readonly language: "zh" | "en";
}

/** Per-style image template pair. */
interface StyleImageTemplate {
  readonly realistic: string;
  readonly cg3d: string;
}

/** Shape of the per-genre prompt templates (mirrors core PromptTemplates). */
interface PromptTemplatesData {
  readonly image: {
    readonly character: StyleImageTemplate;
    readonly scene: StyleImageTemplate;
    readonly prop: StyleImageTemplate;
  };
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

interface GenreDetail {
  readonly profile: {
    readonly name: string;
    readonly id: string;
    readonly language: string;
    readonly chapterTypes: ReadonlyArray<string>;
    readonly fatigueWords: ReadonlyArray<string>;
    readonly numericalSystem: boolean;
    readonly powerScaling: boolean;
    readonly eraResearch: boolean;
    readonly pacingRule: string;
    readonly auditDimensions: ReadonlyArray<number>;
    readonly artStyle?: ArtStyle;
    readonly promptTemplates?: PromptTemplatesData;
  };
  readonly body: string;
}

type ImageFieldKey = keyof PromptTemplatesData["image"];
type VoiceFieldKey = keyof PromptTemplatesData["voice"];

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

const EMPTY_STYLE: StyleImageTemplate = { realistic: "", cg3d: "" };

const EMPTY_PROMPT_TEMPLATES: PromptTemplatesData = {
  image: {
    character: { ...EMPTY_STYLE },
    scene: { ...EMPTY_STYLE },
    prop: { ...EMPTY_STYLE },
  },
  voice: {
    boy: "", girl: "", youngMale: "", youngFemale: "",
    middleMale: "", middleFemale: "", elderMale: "", elderFemale: "",
  },
};

interface GenreFormData {
  readonly id: string;
  readonly name: string;
  readonly language: "zh" | "en";
  readonly chapterTypes: string;
  readonly fatigueWords: string;
  readonly numericalSystem: boolean;
  readonly powerScaling: boolean;
  readonly eraResearch: boolean;
  readonly pacingRule: string;
  readonly body: string;
  readonly artStyle: ArtStyle;
  readonly promptTemplates: PromptTemplatesData;
}

const EMPTY_FORM: GenreFormData = {
  id: "",
  name: "",
  language: "zh",
  chapterTypes: "",
  fatigueWords: "",
  numericalSystem: false,
  powerScaling: false,
  eraResearch: false,
  pacingRule: "",
  body: "",
  artStyle: "realistic",
  promptTemplates: EMPTY_PROMPT_TEMPLATES,
};

function parseCommaSeparated(value: string): ReadonlyArray<string> {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function summarizeTemplate(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

// ---------------------------------------------------------------------------
// Form component (with tabs: basic / image / voice)
// ---------------------------------------------------------------------------

type FormTab = "basic" | "image" | "voice";
type ImageStyleTab = ArtStyle;

function GenreForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  isEdit,
  c,
  t,
}: {
  readonly form: GenreFormData;
  readonly onChange: (next: GenreFormData) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
  readonly isEdit: boolean;
  readonly c: ReturnType<typeof useColors>;
  readonly t: TFunction;
}) {
  const [tab, setTab] = useState<FormTab>("basic");
  const [imgStyle, setImgStyle] = useState<ImageStyleTab>(form.artStyle);
  const set = <K extends keyof GenreFormData>(key: K, value: GenreFormData[K]) =>
    onChange({ ...form, [key]: value });

  const setImage = (kind: ImageFieldKey, style: ArtStyle, value: string) =>
    onChange({
      ...form,
      promptTemplates: {
        ...form.promptTemplates,
        image: {
          ...form.promptTemplates.image,
          [kind]: { ...form.promptTemplates.image[kind], [style]: value },
        },
      },
    });
  const setVoice = (key: VoiceFieldKey, value: string) =>
    onChange({
      ...form,
      promptTemplates: {
        ...form.promptTemplates,
        voice: { ...form.promptTemplates.voice, [key]: value },
      },
    });

  const tabBtn = (key: FormTab) =>
    `px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors ${
      tab === key
        ? "border-primary text-primary font-medium"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  const styleBtn = (key: ArtStyle) =>
    `px-3 py-1.5 text-xs rounded-md border transition-colors ${
      imgStyle === key
        ? "border-primary bg-primary/10 text-primary"
        : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        <button className={tabBtn("basic")} onClick={() => setTab("basic")}>
          {t("genre.tabBasic")}
        </button>
        <button className={tabBtn("image")} onClick={() => setTab("image")}>
          {t("genre.tabImage")}
        </button>
        <button className={tabBtn("voice")} onClick={() => setTab("voice")}>
          {t("genre.tabVoice")}
        </button>
      </div>

      {/* --- Basic tab --- */}
      {tab === "basic" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">ID</label>
              <input
                type="text"
                value={form.id}
                onChange={(e) => set("id", e.target.value)}
                disabled={isEdit}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("genre.name")}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("create.language")}</label>
              <select
                value={form.language}
                onChange={(e) => set("language", e.target.value as "zh" | "en")}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="zh">zh</option>
                <option value="en">en</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("genre.artStyle")}</label>
              <select
                value={form.artStyle}
                onChange={(e) => {
                  const next = e.target.value as ArtStyle;
                  set("artStyle", next);
                  setImgStyle(next);
                }}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="realistic">{t("genre.artStyleRealistic")}</option>
                <option value="cg3d">{t("genre.artStyleCG3D")}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">
              {t("genre.chapterTypes")} ({t("genre.commaSeparated")})
            </label>
            <input
              type="text"
              value={form.chapterTypes}
              onChange={(e) => set("chapterTypes", e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">
              {t("genre.fatigueWords")} ({t("genre.commaSeparated")})
            </label>
            <input
              type="text"
              value={form.fatigueWords}
              onChange={(e) => set("fatigueWords", e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.numericalSystem} onChange={(e) => set("numericalSystem", e.target.checked)} />
              {t("genre.numericalSystem")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.powerScaling} onChange={(e) => set("powerScaling", e.target.checked)} />
              {t("genre.powerScaling")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.eraResearch} onChange={(e) => set("eraResearch", e.target.checked)} />
              {t("genre.eraResearch")}
            </label>
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("genre.pacingRule")}</label>
            <input
              type="text"
              value={form.pacingRule}
              onChange={(e) => set("pacingRule", e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("genre.rulesMd")}</label>
            <textarea
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>
      )}

      {/* --- Image tab --- */}
      {tab === "image" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{t("genre.templateHint")}</p>
          {/* Style sub-tab switcher */}
          <div className="flex gap-2">
            <button className={styleBtn("realistic")} onClick={() => setImgStyle("realistic")}>
              {t("genre.artStyleRealistic")}
            </button>
            <button className={styleBtn("cg3d")} onClick={() => setImgStyle("cg3d")}>
              {t("genre.artStyleCG3D")}
            </button>
          </div>
          {IMAGE_FIELDS.map(({ key, labelKey }) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                {t(labelKey)} ({imgStyle === "realistic" ? t("genre.artStyleRealistic") : t("genre.artStyleCG3D")})
              </label>
              <textarea
                value={form.promptTemplates.image[key][imgStyle]}
                onChange={(e) => setImage(key, imgStyle, e.target.value)}
                rows={10}
                placeholder={t("genre.templateHint")}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          ))}
        </div>
      )}

      {/* --- Voice tab --- */}
      {tab === "voice" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{t("genre.templateHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {VOICE_FIELDS.map(({ key, labelKey }) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground uppercase tracking-wide">{t(labelKey)}</label>
                <textarea
                  value={form.promptTemplates.voice[key]}
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

      <div className="flex gap-2 pt-2 border-t border-border/40">
        <button onClick={onSubmit} className={`px-4 py-2 text-sm rounded-md ${c.btnPrimary}`}>
          {isEdit ? t("genre.saveChanges") : t("genre.createNew")}
        </button>
        <button onClick={onCancel} className={`px-4 py-2 text-sm rounded-md ${c.btnSecondary}`}>
          {t("genre.cancel")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Nav {
  toDashboard: () => void;
}

export function GenreManager({ nav, theme, t }: { nav: Nav; theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const { lang } = useI18n();
  const { data, refetch } = useApi<{ genres: ReadonlyArray<GenreInfo> }>("/genres");
  const [selected, setSelected] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"hidden" | "create" | "edit">("hidden");
  const [form, setForm] = useState<GenreFormData>(EMPTY_FORM);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const filteredGenres = filterGenresForLanguage(data?.genres ?? [], lang);
  const validSelected = selected && filteredGenres.some((g) => g.id === selected) ? selected : null;
  const selectedGenre = filteredGenres.find((g) => g.id === validSelected) ?? null;

  const { data: detail } = useApi<GenreDetail>(validSelected ? `/genres/${validSelected}` : "");

  const handleCopy = async (id: string) => {
    await postApi(`/genres/${id}/copy`);
    alert(`Copied ${id} to project genres/`);
    refetch();
  };

  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setFormMode("create");
  };

  const openEditForm = () => {
    if (!detail) return;
    setForm({
      id: detail.profile.id,
      name: detail.profile.name,
      language: detail.profile.language as "zh" | "en",
      chapterTypes: detail.profile.chapterTypes.join(", "),
      fatigueWords: detail.profile.fatigueWords.join(", "),
      numericalSystem: detail.profile.numericalSystem,
      powerScaling: detail.profile.powerScaling,
      eraResearch: detail.profile.eraResearch ?? false,
      pacingRule: detail.profile.pacingRule,
      body: detail.body,
      artStyle: detail.profile.artStyle ?? "realistic",
      promptTemplates: detail.profile.promptTemplates ?? EMPTY_PROMPT_TEMPLATES,
    });
    setFormMode("edit");
  };

  const closeForm = () => setFormMode("hidden");

  const handleCreate = async () => {
    try {
      await postApi("/genres/create", {
        id: form.id,
        name: form.name,
        language: form.language,
        chapterTypes: parseCommaSeparated(form.chapterTypes),
        fatigueWords: parseCommaSeparated(form.fatigueWords),
        numericalSystem: form.numericalSystem,
        powerScaling: form.powerScaling,
        eraResearch: form.eraResearch,
        pacingRule: form.pacingRule,
        artStyle: form.artStyle,
        body: form.body,
        promptTemplates: form.promptTemplates,
      });
      setFormMode("hidden");
      setSelected(form.id);
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create genre");
    }
  };

  const handleEdit = async () => {
    if (!validSelected) return;
    try {
      await fetchJson(`/genres/${validSelected}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            id: form.id,
            name: form.name,
            language: form.language,
            chapterTypes: parseCommaSeparated(form.chapterTypes),
            fatigueWords: parseCommaSeparated(form.fatigueWords),
            numericalSystem: form.numericalSystem,
            powerScaling: form.powerScaling,
            eraResearch: form.eraResearch,
            pacingRule: form.pacingRule,
          },
          body: form.body,
          artStyle: form.artStyle,
          promptTemplates: form.promptTemplates,
        }),
      });
      setFormMode("hidden");
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update genre");
    }
  };

  const handleDelete = async () => {
    if (!validSelected) return;
    setConfirmDeleteOpen(false);
    try {
      await fetchJson(`/genres/${validSelected}`, { method: "DELETE" });
      setSelected(null);
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete genre");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={openCreateForm}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${c.btnPrimary}`}
        >
          <Plus size={16} />
          {t("genre.createNew")}
        </button>
      </div>

      {formMode !== "hidden" && (
        <div className={`border ${c.cardStatic} rounded-lg p-6`}>
          <h2 className="text-lg font-medium mb-4">
            {formMode === "create" ? t("genre.createNew") : `${t("common.edit")}: ${form.id}`}
          </h2>
          <GenreForm
            form={form}
            onChange={setForm}
            onSubmit={formMode === "create" ? handleCreate : handleEdit}
            onCancel={closeForm}
            isEdit={formMode === "edit"}
            c={c}
            t={t}
          />
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Genre list */}
        <div className={`border ${c.cardStatic} rounded-xl overflow-hidden`}>
          <div className="border-b border-border/40 px-4 py-3">
            <div className="text-sm font-semibold">{t("genre.list")}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{filteredGenres.length} {t("genre.available")}</div>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            {filteredGenres.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelected(g.id)}
                className={`w-full border-b border-border/40 px-4 py-3 text-left transition-colors last:border-b-0 ${
                  validSelected === g.id ? "bg-primary/10 text-primary" : "hover:bg-muted/30"
                }`}
              >
                <div className="text-sm font-medium">{g.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {g.id} · {g.language} · {g.source}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className={`border ${c.cardStatic} rounded-xl p-6 min-h-[400px]`}>
          {validSelected && detail ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-medium">{detail.profile.name}</h2>
                  <div className="text-sm text-muted-foreground mt-1">
                    {detail.profile.id} · {detail.profile.language} ·
                    {detail.profile.numericalSystem ? " Numerical" : ""}
                    {detail.profile.powerScaling ? " Power" : ""}
                    {detail.profile.eraResearch ? " Era" : ""}
                    {" · "}
                    {detail.profile.artStyle === "cg3d" ? t("genre.artStyleCG3D") : t("genre.artStyleRealistic")}
                  </div>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <button
                    onClick={openEditForm}
                    className={`flex w-full items-center justify-center gap-1.5 px-3 py-1.5 text-sm ${c.btnSecondary} rounded-md sm:w-auto`}
                  >
                    <Pencil size={14} />
                    {t("common.edit")}
                  </button>
                  {selectedGenre?.source === "project" && (
                    <button
                      onClick={() => setConfirmDeleteOpen(true)}
                      className={`flex w-full items-center justify-center gap-1.5 px-3 py-1.5 text-sm ${c.btnDanger} rounded-md sm:w-auto`}
                    >
                      <Trash2 size={14} />
                      {t("common.delete")}
                    </button>
                  )}
                  <button
                    onClick={() => validSelected && handleCopy(validSelected)}
                    className={`w-full px-3 py-1.5 text-sm ${c.btnSecondary} rounded-md sm:w-auto`}
                  >
                    {t("genre.copyToProject")}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t("genre.chapterTypes")}</div>
                <div className="flex gap-2 flex-wrap">
                  {detail.profile.chapterTypes.map((ct) => (
                    <span key={ct} className="px-2 py-1 text-xs bg-secondary rounded">{ct}</span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t("genre.fatigueWords")}</div>
                <div className="flex gap-2 flex-wrap">
                  {detail.profile.fatigueWords.slice(0, 15).map((w) => (
                    <span key={w} className="px-2 py-1 text-xs bg-secondary rounded">{w}</span>
                  ))}
                  {detail.profile.fatigueWords.length > 15 && (
                    <span className="text-xs text-muted-foreground">+{detail.profile.fatigueWords.length - 15}</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t("genre.pacingRule")}</div>
                <div className="text-sm">{detail.profile.pacingRule || "—"}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t("genre.rules")}</div>
                <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-foreground/80 bg-muted/30 p-4 rounded-md max-h-[300px] overflow-y-auto">
                  {detail.body || "—"}
                </pre>
              </div>

              {/* Prompt templates summary */}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t("genre.promptTemplates")}</div>
                <div className="space-y-3">
                  {/* Image templates summary (both styles) */}
                  <div className="space-y-1.5">
                    {IMAGE_FIELDS.map(({ key, labelKey }) => {
                      const styles = detail.profile.promptTemplates?.image?.[key];
                      return (
                        <div key={key} className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground shrink-0 w-28">{t(labelKey)}</span>
                          <div className="flex flex-col gap-0.5">
                            <span className={styles?.realistic?.trim() ? "text-foreground/80" : "text-muted-foreground italic"}>
                              {t("genre.artStyleRealistic")}: {summarizeTemplate(styles?.realistic ?? "") || t("genre.usingDefault")}
                            </span>
                            <span className={styles?.cg3d?.trim() ? "text-foreground/80" : "text-muted-foreground italic"}>
                              {t("genre.artStyleCG3D")}: {summarizeTemplate(styles?.cg3d ?? "") || t("genre.usingDefault")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Voice templates */}
                  <div className="flex flex-wrap gap-1.5">
                    {VOICE_FIELDS.map(({ key, labelKey }) => {
                      const hasCustom = Boolean(detail.profile.promptTemplates?.voice?.[key]?.trim());
                      return (
                        <span
                          key={key}
                          className={`px-2 py-1 text-xs rounded ${hasCustom ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}
                          title={hasCustom ? t("genre.customized") : t("genre.usingDefault")}
                        >
                          {t(labelKey)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm italic flex items-center justify-center h-full">
              {t("genre.selectHint")}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t("genre.deleteGenre")}
        message={`${t("genre.confirmDelete")} "${validSelected}"`}
        confirmLabel={t("common.delete") ?? "Delete"}
        cancelLabel={t("genre.cancel") ?? "Cancel"}
        variant="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
