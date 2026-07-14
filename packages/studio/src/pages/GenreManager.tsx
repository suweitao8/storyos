import { fetchJson, useApi } from "../hooks/use-api";
import { useState } from "react";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useI18n } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { Modal } from "../components/Modal";
import { Pencil } from "lucide-react";
import { filterGenresForLanguage, getGenreListDisplayName } from "./genre-page-state";

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
  };
  readonly body: string;
}

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
};

function parseCommaSeparated(value: string): ReadonlyArray<string> {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Form component
// ---------------------------------------------------------------------------

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
  const set = <K extends keyof GenreFormData>(key: K, value: GenreFormData[K]) =>
    onChange({ ...form, [key]: value });

  return (
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
            onChange={(e) => set("artStyle", e.target.value as ArtStyle)}
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

      <div className="flex gap-2">
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

export function GenreManager({ theme, t }: { theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const { lang } = useI18n();
  const { data, refetch } = useApi<{ genres: ReadonlyArray<GenreInfo> }>("/genres");
  const [selected, setSelected] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"hidden" | "edit">("hidden");
  const [form, setForm] = useState<GenreFormData>(EMPTY_FORM);

  const filteredGenres = filterGenresForLanguage(data?.genres ?? [], lang);
  const validSelected = selected && filteredGenres.some((g) => g.id === selected) ? selected : null;
  const selectedGenre = filteredGenres.find((g) => g.id === validSelected) ?? null;

  const { data: detail } = useApi<GenreDetail>(validSelected ? `/genres/${validSelected}` : "");

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
    });
    setFormMode("edit");
  };

  const closeForm = () => setFormMode("hidden");

  const isZh = lang === "zh";
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
        }),
      });
      setFormMode("hidden");
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update genre");
    }
  };

  return (
    <div className="space-y-5">
      <Modal
        open={formMode !== "hidden"}
        title={`${t("common.edit")}: ${form.id}`}
        onClose={closeForm}
        maxWidth="max-w-2xl"
      >
        <GenreForm
          form={form}
          onChange={setForm}
          onSubmit={handleEdit}
          onCancel={closeForm}
          isEdit
          c={c}
          t={t}
        />
      </Modal>

      <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Genre list */}
        <div className={`border ${c.cardStatic} rounded-xl overflow-hidden`}>
          <div className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
            <div>
              <div className="text-sm font-semibold">{t("genre.list")}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{filteredGenres.length} {t("genre.available")}</div>
            </div>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-x-auto overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("genre.name")}</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">{isZh ? "来源" : "Source"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredGenres.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => setSelected(g.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(g.id);
                      }
                    }}
                    tabIndex={0}
                    aria-selected={validSelected === g.id}
                    className={`cursor-pointer outline-none transition-colors focus-visible:bg-primary/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 ${
                      validSelected === g.id ? "bg-primary/10 text-primary" : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">{getGenreListDisplayName(g)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{g.id}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{g.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    {detail.profile.id}
                    {detail.profile.numericalSystem ? " · Numerical" : ""}
                    {detail.profile.powerScaling ? " · Power" : ""}
                    {detail.profile.eraResearch ? " · Era" : ""}
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
            </div>
          ) : (
            <div className="text-muted-foreground text-sm italic flex items-center justify-center h-full">
              {t("genre.selectHint")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
