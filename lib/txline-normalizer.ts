import type { MatchEvent, MatchEventKind, TeamSide } from "./match-events";
import { parseSseBlock } from "./sse.ts";

type RawScore = {
  FixtureId?: number;
  Seq?: number;
  Id?: number;
  Ts?: number;
  Action?: string;
  Confirmed?: boolean;
  StatusId?: number;
  Participant?: 1 | 2;
  Participant1IsHome?: boolean;
  Clock?: { Seconds?: number };
  Score?: {
    Participant1?: { Total?: { Goals?: number } };
    Participant2?: { Total?: { Goals?: number } };
  };
  Data?: { Outcome?: string };
  Stats?: Record<string, number>;
};

function teamSide(raw: RawScore): TeamSide | undefined {
  if (!raw.Participant) return undefined;
  const participantOneIsHome = raw.Participant1IsHome !== false;
  if (raw.Participant === 1) return participantOneIsHome ? "home" : "away";
  return participantOneIsHome ? "away" : "home";
}

function eventKind(raw: RawScore): MatchEventKind | null {
  if (raw.Action === "goal" && raw.Confirmed) return "goal";
  if (raw.Action === "yellow_card" && raw.Confirmed) return "yellow_card";
  if (raw.Action === "red_card" && raw.Confirmed) return "red_card";
  if (raw.Action === "shot" && raw.Confirmed && raw.Data?.Outcome === "OnTarget") {
    return "shot_on_target";
  }
  if (raw.Action === "corner" && raw.Confirmed) return "corner";
  if (raw.Action === "status" && raw.StatusId === 2) return "match_started";
  if (raw.Action === "game_finalised" && raw.StatusId === 100) return "match_finished";
  return null;
}

export function normalizeTxlineScore(value: unknown, source: "txline" | "replay"): MatchEvent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as RawScore;
  const kind = eventKind(raw);
  if (!kind || !raw.FixtureId || raw.Seq === undefined) return null;

  const clockMinute = Math.floor((raw.Clock?.Seconds ?? 0) / 60);
  const minute = kind === "match_finished" && clockMinute === 0 ? 90 : clockMinute;
  const participantOneGoals = raw.Score?.Participant1?.Total?.Goals ?? raw.Stats?.["1"] ?? 0;
  const participantTwoGoals = raw.Score?.Participant2?.Total?.Goals ?? raw.Stats?.["2"] ?? 0;
  const participantOneIsHome = raw.Participant1IsHome !== false;

  return {
    id: `${raw.FixtureId}-${raw.Id ?? raw.Seq}-${kind}`,
    fixtureId: raw.FixtureId,
    seq: raw.Seq,
    kind,
    minute,
    team: teamSide(raw),
    homeScore: participantOneIsHome ? participantOneGoals : participantTwoGoals,
    awayScore: participantOneIsHome ? participantTwoGoals : participantOneGoals,
    occurredAt: new Date(raw.Ts ?? Date.now()).toISOString(),
    source,
    raw: value,
  };
}

export function normalizeHistoricalSse(text: string): MatchEvent[] {
  const deduplicated = new Map<string, MatchEvent>();

  for (const block of text.split(/\r?\n\r?\n/)) {
    const message = parseSseBlock(block);
    if (!message?.data) continue;

    try {
      const event = normalizeTxlineScore(JSON.parse(message.data), "replay");
      if (event) deduplicated.set(event.id, event);
    } catch {
      // Heartbeats and malformed upstream messages are intentionally ignored.
    }
  }

  return [...deduplicated.values()].sort((a, b) => a.seq - b.seq);
}
