export const DEFAULT_ELEVENLABS_ORIGIN = "https://api.elevenlabs.io";
export const DEFAULT_ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
export const DEFAULT_ELEVENLABS_MODEL = "eleven_multilingual_v2";
export const MAX_RECAP_CHARACTERS = 600;

type VoiceEnvironment = Record<string, string | undefined>;

export type VoiceConfig = {
  apiOrigin: string;
  apiKey: string | null;
  voiceId: string;
  model: string;
};

export class VoiceProviderError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "VoiceProviderError";
    this.status = status;
  }
}

export function normalizeRecapText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 3 || text.length > MAX_RECAP_CHARACTERS) return null;
  return text;
}

export function getVoiceConfig(
  environment: VoiceEnvironment = process.env,
): VoiceConfig {
  return {
    apiOrigin: (environment.ELEVENLABS_API_ORIGIN ?? DEFAULT_ELEVENLABS_ORIGIN).replace(/\/+$/, ""),
    apiKey: environment.ELEVENLABS_API_KEY?.trim() || null,
    voiceId: environment.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_ELEVENLABS_VOICE_ID,
    model: environment.ELEVENLABS_MODEL?.trim() || DEFAULT_ELEVENLABS_MODEL,
  };
}

export async function synthesizeRecap(
  text: string,
  options: {
    environment?: VoiceEnvironment;
    fetcher?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<Response> {
  const config = getVoiceConfig(options.environment);
  if (!config.apiKey) {
    throw new VoiceProviderError("Premium recap voice is not configured", 503);
  }

  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    `${config.apiOrigin}/v1/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": config.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: config.model,
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.78,
          style: 0.28,
          use_speaker_boost: true,
        },
      }),
      cache: "no-store",
      signal: options.signal,
    },
  );

  if (!response.ok || !response.body) {
    throw new VoiceProviderError("Premium recap voice is temporarily unavailable", 502);
  }
  return response;
}
