import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ELEVENLABS_MODEL,
  DEFAULT_ELEVENLABS_VOICE_ID,
  getVoiceConfig,
  MAX_RECAP_CHARACTERS,
  normalizeRecapText,
  synthesizeRecap,
  VoiceProviderError,
} from "../lib/voice.ts";

test("normalizes short recap copy and rejects invalid or oversized input", () => {
  assert.equal(normalizeRecapText("  Belgium   equalised.\nThe score is 1–1.  "), "Belgium equalised. The score is 1–1.");
  assert.equal(normalizeRecapText(""), null);
  assert.equal(normalizeRecapText(42), null);
  assert.equal(normalizeRecapText("x".repeat(MAX_RECAP_CHARACTERS + 1)), null);
});

test("uses a production-safe ElevenLabs default voice and model", () => {
  const config = getVoiceConfig({ ELEVENLABS_API_KEY: "secret" });
  assert.equal(config.voiceId, DEFAULT_ELEVENLABS_VOICE_ID);
  assert.equal(config.model, DEFAULT_ELEVENLABS_MODEL);
  assert.equal(config.apiKey, "secret");
});

test("sends recap text to ElevenLabs without exposing the key in the URL or body", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(url);
    requestInit = init;
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });
  }) as typeof fetch;

  const response = await synthesizeRecap("Belgium changed the story.", {
    environment: {
      ELEVENLABS_API_KEY: "server-only-key",
      ELEVENLABS_VOICE_ID: "voice-123",
      ELEVENLABS_MODEL: "eleven_flash_v2_5",
    },
    fetcher,
  });

  assert.equal(response.status, 200);
  assert.match(requestUrl, /\/v1\/text-to-speech\/voice-123/);
  assert.doesNotMatch(requestUrl, /server-only-key/);
  assert.equal(new Headers(requestInit?.headers).get("xi-api-key"), "server-only-key");
  assert.doesNotMatch(String(requestInit?.body), /server-only-key/);
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    text: "Belgium changed the story.",
    model_id: "eleven_flash_v2_5",
    voice_settings: {
      stability: 0.42,
      similarity_boost: 0.78,
      style: 0.28,
      use_speaker_boost: true,
    },
  });
});

test("fails closed when the server-side ElevenLabs key is absent", async () => {
  await assert.rejects(
    () => synthesizeRecap("A verified recap.", { environment: {} }),
    (error: unknown) => error instanceof VoiceProviderError && error.status === 503,
  );
});
