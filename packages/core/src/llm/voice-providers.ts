/**
 * Voice (TTS) provider presets for the Studio model configuration page.
 *
 * Currently only Alibaba Cloud Bailian (DashScope) CosyVoice is supported,
 * modelled after the animcg project's TTS implementation.
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
 * Test a TTS connection by sending a short text to the CosyVoice API.
 * Returns { success: true } on success, or throws on failure.
 *
 * Uses the CosyVoice SpeechSynthesizer endpoint:
 * POST {baseUrl}/services/audio/tts/SpeechSynthesizer
 */
export async function testVoiceConnection(params: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
}): Promise<{ readonly success: boolean; readonly message: string }> {
  const endpoint = `${params.baseUrl.replace(/\/+$/u, "")}/services/audio/tts/SpeechSynthesizer`;
  const testText = "你好，这是一段测试语音。";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      input: {
        text: testText,
        voice: "longxiaochun",
        format: "mp3",
        sample_rate: 24000,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`TTS test failed: HTTP ${response.status} ${text.slice(0, 300)}`);
  }

  // Check that the response contains audio data.
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!data) {
    throw new Error("TTS test returned non-JSON response");
  }

  const output = data.output as Record<string, unknown> | undefined;
  const audio = output?.audio as Record<string, unknown> | undefined;
  if (!audio?.data && !audio?.url) {
    throw new Error("TTS test response did not include audio data");
  }

  return { success: true, message: "TTS connection successful" };
}
