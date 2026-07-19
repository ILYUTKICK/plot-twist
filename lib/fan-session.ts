import {
  resolvePrediction,
  type MatchEvent,
  type PredictionId,
  type PredictionResult,
  type PredictionTarget,
  type TeamSide,
} from "./match-events.ts";

export type ActiveFanCall = PredictionTarget & {
  roundEventId: string;
  label: string;
  xp: number;
  deadlineMinute: number;
};

export type SettledFanCall = {
  fixtureId: number;
  roundEventId: string;
  predictionId: PredictionId;
  label: string;
  team?: TeamSide;
  deadlineMinute: number;
  result: Exclude<PredictionResult, "pending">;
  settledByEventId: string;
  settledMinute: number;
  xp: number;
};

export type FanSession = {
  fixtureId: number;
  xp: number;
  streak: number;
  bestStreak: number;
  records: SettledFanCall[];
};

export function emptyFanSession(fixtureId: number): FanSession {
  return { fixtureId, xp: 0, streak: 0, bestStreak: 0, records: [] };
}
export function settleFanCall(
  session: FanSession,
  call: ActiveFanCall,
  event: MatchEvent,
): { session: FanSession; result: PredictionResult; record: SettledFanCall | null } {
  if (session.fixtureId !== call.fixtureId || session.fixtureId !== event.fixtureId) {
    return { session, result: "pending", record: null };
  }
  if (session.records.some((record) => record.roundEventId === call.roundEventId)) {
    return { session, result: "pending", record: null };
  }

  const result = resolvePrediction(call, event, call.deadlineMinute);
  if (result === "pending") return { session, result, record: null };

  const awardedXp = result === "won" ? call.xp : 0;
  const nextStreak = result === "won" ? session.streak + 1 : 0;
  const record: SettledFanCall = {
    fixtureId: call.fixtureId,
    roundEventId: call.roundEventId,
    predictionId: call.id,
    label: call.label,
    team: call.team,
    deadlineMinute: call.deadlineMinute,
    result,
    settledByEventId: event.id,
    settledMinute: event.minute,
    xp: awardedXp,
  };

  return {
    result,
    record,
    session: {
      ...session,
      xp: session.xp + awardedXp,
      streak: nextStreak,
      bestStreak: Math.max(session.bestStreak, nextStreak),
      records: [...session.records, record],
    },
  };
}

export function sessionAccuracy(session: FanSession) {
  if (!session.records.length) return 0;
  const won = session.records.filter((record) => record.result === "won").length;
  return Math.round((won / session.records.length) * 100);
}

export function parseFanSession(value: string | null, fixtureId: number): FanSession {
  if (!value) return emptyFanSession(fixtureId);
  try {
    const candidate = JSON.parse(value) as Partial<FanSession>;
    if (
      candidate.fixtureId !== fixtureId
      || !Number.isFinite(candidate.xp)
      || !Number.isInteger(candidate.streak)
      || !Number.isInteger(candidate.bestStreak)
      || !Array.isArray(candidate.records)
    ) return emptyFanSession(fixtureId);
    return candidate as FanSession;
  } catch {
    return emptyFanSession(fixtureId);
  }
}
