import type { PredictionId } from "./match-events";

export const ACHIEVEMENT_CALL_TARGET = 2;

export type VerifiedCallProof = {
  predictionId: PredictionId;
  eventId: string;
  minute: number;
  xp: number;
};

type AchievementMemoInput = {
  fixtureId: number;
  wallet: string;
  calls: VerifiedCallProof[];
  issuedAt: string;
};

export type AchievementMemoRecord = {
  app: "PLOT_TWIST";
  version: 1 | 2;
  type: "fan-achievement";
  achievement: "PLOT_TWISTER";
  network: "solana-devnet";
  verification: "wallet-signed-memo";
  fixtureId: number;
  wallet: string;
  calls: Array<{
    prediction: PredictionId;
    event: string;
    minute: number;
    xp: number;
  }>;
  sessionXp: number;
  issuedAt: string;
};

function isPredictionId(value: unknown): value is PredictionId {
  return value === "shot" || value === "card" || value === "goal";
}

export function parseAchievementMemo(value: string): AchievementMemoRecord | null {
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    const version = raw.version;
    const fixtureId = Number(raw.fixtureId);
    const wallet = String(raw.wallet ?? "");
    const issuedAt = String(raw.issuedAt ?? "");
    const rawCalls = version === 2 ? raw.resolvedCalls : raw.verifiedCalls;
    if (
      raw.app !== "PLOT_TWIST"
      || (version !== 1 && version !== 2)
      || raw.type !== "fan-achievement"
      || raw.achievement !== "PLOT_TWISTER"
      || raw.network !== "solana-devnet"
      || !Number.isInteger(fixtureId)
      || fixtureId <= 0
      || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)
      || !Number.isFinite(Date.parse(issuedAt))
      || !Array.isArray(rawCalls)
      || rawCalls.length !== ACHIEVEMENT_CALL_TARGET
    ) return null;

    const calls = rawCalls.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const call = value as Record<string, unknown>;
      const prediction = call.prediction;
      const event = String(call.event ?? "");
      const minute = Number(call.minute);
      const xp = Number(call.xp);
      if (
        !isPredictionId(prediction)
        || !event.startsWith(`${fixtureId}-`)
        || !Number.isInteger(minute)
        || minute < 0
        || minute > 130
        || !Number.isInteger(xp)
        || xp <= 0
      ) return [];
      return [{ prediction, event, minute, xp }];
    });

    if (calls.length !== ACHIEVEMENT_CALL_TARGET) return null;
    if (new Set(calls.map((call) => call.event)).size !== calls.length) return null;
    const sessionXp = calls.reduce((total, call) => total + call.xp, 0);
    if (Number(raw.sessionXp) !== sessionXp) return null;
    if (version === 2 && raw.verification !== "wallet-signed-memo") return null;

    return {
      app: "PLOT_TWIST",
      version,
      type: "fan-achievement",
      achievement: "PLOT_TWISTER",
      network: "solana-devnet",
      verification: "wallet-signed-memo",
      fixtureId,
      wallet,
      calls,
      sessionXp,
      issuedAt,
    };
  } catch {
    return null;
  }
}

export function buildAchievementMemo(input: AchievementMemoInput) {
  return JSON.stringify({
    app: "PLOT_TWIST",
    version: 2,
    type: "fan-achievement",
    achievement: "PLOT_TWISTER",
    network: "solana-devnet",
    verification: "wallet-signed-memo",
    fixtureId: input.fixtureId,
    wallet: input.wallet,
    resolvedCalls: input.calls.map((call) => ({
      prediction: call.predictionId,
      event: call.eventId,
      minute: call.minute,
      xp: call.xp,
    })),
    sessionXp: input.calls.reduce((total, call) => total + call.xp, 0),
    issuedAt: input.issuedAt,
  });
}
