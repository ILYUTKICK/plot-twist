import { NextResponse } from "next/server";
import { DEMO_MATCH } from "@/lib/replay";
import { txlineFetch } from "@/lib/txline-client";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

type ReadinessState = "ready" | "fallback" | "error";

type ReadinessCheck = {
  state: ReadinessState;
  latencyMs: number;
  detail: string;
};

async function timedCheck(
  check: () => Promise<Omit<ReadinessCheck, "latencyMs">>,
): Promise<ReadinessCheck> {
  const startedAt = Date.now();
  try {
    return { ...await check(), latencyMs: Date.now() - startedAt };
  } catch {
    return {
      state: "error",
      latencyMs: Date.now() - startedAt,
      detail: "Unavailable",
    };
  }
}

async function checkTxline() {
  if (!process.env.TXLINE_API_TOKEN) {
    return { state: "fallback", detail: "Recorded replay" } as const;
  }

  const response = await txlineFetch(`/scores/historical/${DEMO_MATCH.fixtureId}`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`TxLINE ${response.status}`);
  await response.body?.cancel();
  return { state: "ready", detail: `Fixture ${DEMO_MATCH.fixtureId} ready` } as const;
}

async function checkOllama() {
  const apiKey = process.env.OLLAMA_API_KEY;
  const model = process.env.OLLAMA_MODEL ?? "gpt-oss:20b";
  if (!apiKey) {
    return { state: "fallback", detail: "Safe copy fallback" } as const;
  }

  const baseUrl = (process.env.OLLAMA_BASE_URL ?? "https://ollama.com/api").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/tags`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Ollama ${response.status}`);
  const payload = await response.json() as {
    models?: Array<{ model?: string; name?: string }>;
  };
  const modelAvailable = payload.models?.some((entry) => (
    entry.model === model || entry.name === model
  ));
  return {
    state: "ready",
    detail: modelAvailable === false ? "Cloud connected" : model,
  } as const;
}

async function checkSolana() {
  const response = await fetch("https://api.devnet.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Solana ${response.status}`);
  const payload = await response.json() as { result?: string };
  if (payload.result !== "ok") throw new Error("Solana unhealthy");
  return { state: "ready", detail: "Devnet healthy" } as const;
}

export async function GET() {
  const [txline, ollama, solana] = await Promise.all([
    timedCheck(checkTxline),
    timedCheck(checkOllama),
    timedCheck(checkSolana),
  ]);
  const checks = { txline, ollama, solana };

  return NextResponse.json({
    ready: Object.values(checks).every((check) => check.state !== "error"),
    checkedAt: new Date().toISOString(),
    checks,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
