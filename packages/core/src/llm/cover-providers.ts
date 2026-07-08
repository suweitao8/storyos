export type CoverProviderId = "grsai";

export interface CoverProviderPreset {
  readonly service: CoverProviderId;
  readonly label: string;
  readonly baseUrl: string;
  readonly api: "responses" | "images" | "gemini" | "grsai";
  readonly defaultModel: string;
  readonly models: readonly string[];
}

export const COVER_PROVIDER_PRESETS: readonly CoverProviderPreset[] = [
  {
    service: "grsai",
    label: "Grsai",
    baseUrl: "https://grsai.dakka.com.cn",
    api: "grsai",
    defaultModel: "gpt-image-2",
    models: ["gpt-image-2", "nano-banana-fast"],
  },
];

export function resolveCoverProviderPreset(service: string | undefined): CoverProviderPreset | undefined {
  return COVER_PROVIDER_PRESETS.find((provider) => provider.service === service);
}

export function coverSecretKey(service: string): string {
  return `cover:${service}`;
}
