export type MatchEventKind =
  | "match_started"
  | "goal"
  | "yellow_card"
  | "red_card"
  | "shot_on_target"
  | "odds_shift"
  | "match_finished";

export type TeamSide = "home" | "away";

export type MatchEvent = {
  id: string;
  fixtureId: number;
  seq: number;
  kind: MatchEventKind;
  minute: number;
  team?: TeamSide;
  homeScore: number;
  awayScore: number;
  occurredAt: string;
  source: "txline" | "replay";
  raw?: unknown;
};

export type PredictionId = "shot" | "card" | "goal";

export type PredictionTarget = {
  id: PredictionId;
  fixtureId: number;
  team?: TeamSide;
};

export type PredictionResult = "pending" | "won" | "lost";

const TARGETS: Record<PredictionId, MatchEventKind> = {
  shot: "shot_on_target",
  card: "yellow_card",
  goal: "goal",
};

export function resolvePrediction(
  prediction: PredictionTarget,
  event: MatchEvent,
  deadlineMinute = 77,
): PredictionResult {
  if (event.fixtureId !== prediction.fixtureId) return "pending";
  if (event.minute > deadlineMinute) return "lost";
  if (event.kind === TARGETS[prediction.id]) {
    if (prediction.id === "goal") return "won";
    return event.team === prediction.team ? "won" : "pending";
  }
  return event.minute === deadlineMinute ? "lost" : "pending";
}
