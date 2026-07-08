export interface ServiceConfigCardModelInfo {
  readonly id: string;
  readonly name?: string;
}

export interface ServiceConfigCardModelSource {
  readonly defaultModel: string;
  readonly models: ReadonlyArray<string>;
}

export interface ServiceConfigCardTestRequest {
  readonly apiKey: string;
  readonly model: string;
}

export interface ServiceConfigCardTestResponse {
  readonly ok: boolean;
  readonly error?: string;
  readonly message?: string;
  readonly models?: ReadonlyArray<ServiceConfigCardModelInfo>;
  readonly selectedModel?: string;
}

export interface ServiceConfigCardSaveRequest {
  readonly apiKey: string;
  readonly model: string;
}

export interface ServiceConfigCardSaveResponse {
  readonly ok: boolean;
  readonly error?: string;
  readonly message?: string;
}

export interface ServiceConfigCardSecretSnapshotInput {
  readonly service: string;
  readonly model: string;
  readonly apiKey: string;
}

export const MASKED_API_KEY = "********";

export function resolveSingleModel(
  provider: ServiceConfigCardModelSource | undefined,
  currentModel: string,
  fallbackModel: string,
): string {
  const models = provider?.models ?? [];
  if (models.length === 1) return models[0];

  const trimmedCurrent = currentModel.trim();
  if (trimmedCurrent && models.includes(trimmedCurrent)) return trimmedCurrent;

  const trimmedDefault = provider?.defaultModel.trim() ?? "";
  if (trimmedDefault && models.includes(trimmedDefault)) return trimmedDefault;

  return models[0] ?? trimmedCurrent ?? fallbackModel;
}

export function buildSecretSnapshot(input: ServiceConfigCardSecretSnapshotInput): string {
  const trimmedApiKey = input.apiKey.trim();
  return JSON.stringify({
    service: input.service.trim(),
    model: input.model.trim(),
    apiKey: trimmedApiKey === MASKED_API_KEY ? MASKED_API_KEY : trimmedApiKey,
  });
}

export function buildServiceConfigTestRequest(input: ServiceConfigCardSecretSnapshotInput): ServiceConfigCardTestRequest {
  return {
    apiKey: input.apiKey.trim(),
    model: input.model.trim(),
  };
}

export function buildServiceConfigSaveRequest(input: ServiceConfigCardSecretSnapshotInput): ServiceConfigCardSaveRequest {
  return {
    apiKey: input.apiKey.trim(),
    model: input.model.trim(),
  };
}
