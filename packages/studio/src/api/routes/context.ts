import type { Hono } from "hono";
import type {
  NodeImageDeps,
  PipelineConfig,
  ProjectConfig,
  StateManager,
} from "@actalk/inkos-core";

export type StudioLanguage = "zh" | "en";

export interface StudioRouteContext {
  readonly app: Hono;
  readonly root: string;
  readonly state: StateManager;
  readonly overrides: { readonly nodeImageGenerator?: NodeImageDeps };
  readonly getProjectConfig: (options?: { readonly requireApiKey?: boolean }) => Promise<ProjectConfig>;
  readonly getLanguage: () => Promise<StudioLanguage>;
  readonly buildPipelineConfig: (options?: {
    readonly currentConfig?: ProjectConfig;
    readonly sessionIdForSSE?: string;
    readonly bookIdForSettings?: string;
    readonly externalContext?: string;
  }) => Promise<PipelineConfig>;
  readonly broadcast: (event: string, data: unknown) => void;
  readonly loadBookListSummary: (bookId: string) => Promise<unknown>;
}
