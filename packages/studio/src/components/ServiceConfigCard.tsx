import { Eye, EyeOff, Loader2, Pencil } from "lucide-react";
import type { ServiceConfigCardModelInfo } from "../pages/service-config-card-state";

export type ServiceConfigCardAutosaveStatus = "idle" | "saving" | "saved" | "testing" | "error";

export interface ServiceConfigCardProps {
  readonly title: string;
  readonly model: string;
  readonly modelOptions: ReadonlyArray<ServiceConfigCardModelInfo | string>;
  readonly apiKey: string;
  readonly showKey: boolean;
  readonly editing: boolean;
  readonly autosaveStatus: ServiceConfigCardAutosaveStatus;
  readonly autosaveMessage?: string;
  readonly onEditToggle: () => void;
  readonly onModelChange: (model: string) => void;
  readonly onApiKeyChange: (apiKey: string) => void;
  readonly onToggleShowKey: () => void;
  readonly onTestConnection: () => void;
}

function statusLabel(status: ServiceConfigCardAutosaveStatus): string {
  switch (status) {
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "testing":
      return "Testing";
    case "error":
      return "Needs attention";
    default:
      return "Ready";
  }
}

function statusTone(status: ServiceConfigCardAutosaveStatus): string {
  switch (status) {
    case "saving":
    case "testing":
      return "text-amber-500";
    case "saved":
      return "text-emerald-500";
    case "error":
      return "text-rose-500";
    default:
      return "text-muted-foreground/70";
  }
}

function optionLabel(option: ServiceConfigCardModelInfo | string): string {
  return typeof option === "string" ? option : (option.name ?? option.id);
}

function optionValue(option: ServiceConfigCardModelInfo | string): string {
  return typeof option === "string" ? option : option.id;
}

export function ServiceConfigCard(props: ServiceConfigCardProps) {
  return (
    <section className="rounded-xl border border-border/50 bg-card/60 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">{props.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Current model and API key only.
          </p>
        </div>
        <button
          type="button"
          onClick={props.onEditToggle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/50"
        >
          <Pencil size={12} />
          {props.editing ? "Done" : "Edit"}
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground/70">Current model</span>
          <select
            value={props.model}
            onChange={(event) => props.onModelChange(event.target.value)}
            disabled={!props.editing}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
          >
            {props.modelOptions.map((option) => {
              const value = optionValue(option);
              return (
                <option key={value} value={value}>
                  {optionLabel(option)}
                </option>
              );
            })}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground/70">API Key</span>
          <div className="relative">
            <input
              type={props.showKey ? "text" : "password"}
              value={props.apiKey}
              onChange={(event) => props.onApiKeyChange(event.target.value)}
              disabled={!props.editing}
              placeholder="sk-..."
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 pr-10 text-sm font-mono disabled:cursor-not-allowed disabled:opacity-70"
            />
            <button
              type="button"
              onClick={props.onToggleShowKey}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              aria-label={props.showKey ? "Hide API key" : "Show API key"}
            >
              {props.showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={props.onTestConnection}
            disabled={props.autosaveStatus === "saving" || props.autosaveStatus === "testing"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {props.autosaveStatus === "testing" ? <Loader2 size={12} className="animate-spin" /> : null}
            Test connection
          </button>
          <span className={`text-xs font-medium ${statusTone(props.autosaveStatus)}`}>
            {statusLabel(props.autosaveStatus)}
          </span>
          {props.autosaveMessage ? (
            <span className="text-xs text-muted-foreground/70">{props.autosaveMessage}</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
