export type MatchEventKind =
  | "match_started"
  | "live_state"
  | "goal"
  | "yellow_card"
  | "red_card"
  | "shot_on_target"
  | "corner"
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

export function isStoryEventKind(
  kind: MatchEventKind,
): kind is "match_started" | "live_state" | "goal" | "yellow_card" | "red_card" | "shot_on_target" | "corner" | "odds_shift" {
  return kind === "match_started"
    || kind === "live_state"
    || kind === "goal"
    || kind === "yellow_card"
    || kind === "red_card"
    || kind === "shot_on_target"
    || kind === "corner"
    || kind === "odds_shift";
}

export function predictionDeadlineFor(minute: number) {
  return Math.min(120, minute + 10);
}

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
