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

/**
 * Test Grsai connectivity without generating an image.
 *
 * We deliberately pass a non-existent model id. A valid API key reaches the
 * provider and returns a model-validation error; an invalid key returns an
 * authentication error. This keeps the test cheap and avoids spending image
 * generation quota.
 */
export async function testCoverConnection(params: {
  readonly baseUrl: string;
  readonly apiKey: string;
}): Promise<{ readonly success: boolean; readonly message: string }> {
  const endpoint = `${params.baseUrl.replace(/\/+$/u, "")}/v1/draw/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      model: "__inkos_auth_check__",
    }),
  });

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Cover test failed: HTTP ${response.status} ${text.slice(0, 300)}`);
  }

  const normalized = text.toLowerCase();
  if (normalized.includes("apikey error")) {
    throw new Error("Cover API key is invalid.");
  }
  if (normalized.includes("model not found")) {
    return { success: true, message: "Cover connection successful" };
  }

  return { success: true, message: "Cover provider reachable" };
}
