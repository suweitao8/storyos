type ServiceConfigCardModelSource = {
  readonly defaultModel: string;
  readonly models: ReadonlyArray<string>;
};

type ServiceConfigCardSecretSnapshotInput = {
  readonly service: string;
  readonly model: string;
  readonly apiKey: string;
};

const MASKED_API_KEY = "********";

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
