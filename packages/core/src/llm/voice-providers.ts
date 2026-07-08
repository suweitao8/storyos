/**
 * Voice (TTS) provider presets for the Studio model configuration page.
 *
 * Currently only Alibaba Cloud Bailian (DashScope) is exposed here.
 */

export type VoiceProviderId = "bailian";

export interface VoiceProviderPreset {
  readonly service: VoiceProviderId;
  readonly label: string;
  readonly baseUrl: string;
  readonly defaultModel: string;
  readonly models: readonly string[];
}

export const VOICE_PROVIDER_PRESETS: readonly VoiceProviderPreset[] = [
  {
    service: "bailian",
    label: "阿里云百炼",
    baseUrl: "https://dashscope.aliyuncs.com/api/v1",
    defaultModel: "cosyvoice-v3.5-plus",
    models: ["cosyvoice-v3.5-plus", "qwen3-tts-vd-2026-01-26"],
  },
];

export function resolveVoiceProviderPreset(service: string | undefined): VoiceProviderPreset | undefined {
  return VOICE_PROVIDER_PRESETS.find((provider) => provider.service === service);
}

export function voiceSecretKey(service: string): string {
  return `voice:${service}`;
}

/**
 * Test Bailian connectivity by listing models.
 *
 * This validates the API key without synthesizing audio, so the test is fast
 * and does not consume TTS quota.
 */
export async function testVoiceConnection(params: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
}): Promise<{ readonly success: boolean; readonly message: string }> {
  void params.baseUrl;
  void params.model;

  const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
  });

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Voice test failed: HTTP ${response.status} ${text.slice(0, 300)}`);
  }

  return { success: true, message: "Voice connection successful" };
}
