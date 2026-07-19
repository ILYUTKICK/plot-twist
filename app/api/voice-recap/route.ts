import { NextResponse } from "next/server";
import {
  getVoiceConfig,
  normalizeRecapText,
  synthesizeRecap,
  VoiceProviderError,
} from "@/lib/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 8;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function withinRateLimit(key: string, now = Date.now()): boolean {
  const bucket = requestBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_REQUESTS) return false;
  bucket.count += 1;
  return true;
}

export async function POST(request: Request) {
  const config = getVoiceConfig();
  if (!config.apiKey) {
    return NextResponse.json(
      { error: "Premium recap voice is not configured", fallback: "browser" },
      { status: 503 },
    );
  }

  if (!withinRateLimit(clientAddress(request))) {
    return NextResponse.json(
      { error: "Voice recap rate limit reached", fallback: "browser" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid voice recap request" }, { status: 400 });
  }
  const text = normalizeRecapText(
    payload && typeof payload === "object" ? (payload as { text?: unknown }).text : null,
  );
  if (!text) {
    return NextResponse.json({ error: "Recap text must contain 3–600 characters" }, { status: 400 });
  }

  try {
    const response = await synthesizeRecap(text, {
      signal: AbortSignal.timeout(45_000),
    });
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "audio/mpeg",
        "Cache-Control": "private, no-store",
        "X-Voice-Provider": "elevenlabs",
        "X-Voice-Model": config.model,
      },
    });
  } catch (error) {
    const status = error instanceof VoiceProviderError ? error.status : 502;
    return NextResponse.json(
      { error: "Premium recap voice is temporarily unavailable", fallback: "browser" },
      { status },
    );
  }
}
