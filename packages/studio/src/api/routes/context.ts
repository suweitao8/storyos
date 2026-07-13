import type { Hono } from "hono";
import type {
  NodeImageDeps,
  PipelineConfig,
  ProjectConfig,
  SecretsFile,
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
  readonly loadRawConfig: () => Promise<Record<string, unknown>>;
  readonly saveRawConfig: (config: Record<string, unknown>) => Promise<void>;
  readonly loadSecrets: () => Promise<SecretsFile>;
  readonly saveSecrets: (secrets: SecretsFile) => Promise<void>;
  readonly isHeaderSafeApiKey: (value: string) => boolean;
  readonly testCoverProviderConnection: (params: { readonly baseUrl: string; readonly apiKey: string }) => Promise<unknown>;
  readonly testVoiceProviderConnection: (params: { readonly apiKey: string }) => Promise<unknown>;
  readonly resolveProjectImageFile: (rawPath: string) => { readonly resolved: string; readonly contentType: string };
  readonly resolveProjectTextArtifactFile: (rawPath: string) => { readonly relPath: string; readonly resolved: string; readonly contentType: string };
}
