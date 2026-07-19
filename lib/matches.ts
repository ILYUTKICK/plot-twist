import { findBestMatchWinnerMarket, type MatchWinnerMarket } from "./odds.ts";

export type MatchPhase = "past" | "live" | "upcoming";

export type MatchTeam = {
  id: number;
  name: string;
  code: string;
  flag: string;
};

export type MatchCatalogItem = {
  fixtureId: number;
  competition: string;
  competitionId: number;
  startTime: string;
  phase: MatchPhase;
  home: MatchTeam;
  away: MatchTeam;
};

export type MatchTimelineEvent = {
  id: string;
  seq: number;
  minute: number;
  kind: "goal" | "yellow_card" | "red_card" | "shot_on_target" | "corner";
  icon: string;
  label: string;
  team: "home" | "away" | null;
  teamName: string | null;
  occurredAt: string;
};

export type MatchLineup = {
  team: string;
  starters: string[];
};

export type MatchDetail = MatchCatalogItem & {
  score: { home: number; away: number } | null;
  minute: number | null;
  clockRunning: boolean;
  events: MatchTimelineEvent[];
  lineups: MatchLineup[];
  odds: MatchWinnerMarket | null;
  conditions: string[];
  stats: {
    home: { goals: number; corners: number };
    away: { goals: number; corners: number };
  } | null;
  coverage: {
    scores: boolean;
    odds: boolean;
    lineups: boolean;
  };
  source: "TxLINE";
};

export type RawTxlineFixture = {
  StartTime?: number;
  Competition?: string;
  CompetitionId?: number;
  FixtureId?: number;
  Participant1Id?: number;
  Participant1?: string;
  Participant2Id?: number;
  Participant2?: string;
  Participant1IsHome?: boolean;
  GameState?: number | string;
};

type RawPlayer = { normativeId?: number; preferredName?: string };
type RawLineupEntry = { starter?: boolean; player?: RawPlayer };
type RawLineup = { preferredName?: string; lineups?: RawLineupEntry[] };
type RawScoreSide = { Total?: { Goals?: number; Corners?: number } };

type RawTxlineScore = {
  FixtureId?: number;
  Seq?: number;
  Id?: number;
  Ts?: number;
  Action?: string;
  Confirmed?: boolean;
  StatusId?: number;
  Participant?: 1 | 2;
  Participant1IsHome?: boolean;
  Clock?: { Running?: boolean; Seconds?: number };
  Score?: { Participant1?: RawScoreSide; Participant2?: RawScoreSide };
  Data?: { Outcome?: string; PlayerId?: number; Conditions?: string[]; Type?: string };
  Lineups?: RawLineup[];
  CoverageType?: string;
};

const TEAM_META: Record<string, { code: string; flag: string }> = {
  Algeria: { code: "ALG", flag: "🇩🇿" },
  Argentina: { code: "ARG", flag: "🇦🇷" },
  Australia: { code: "AUS", flag: "🇦🇺" },
  Austria: { code: "AUT", flag: "🇦🇹" },
  Belgium: { code: "BEL", flag: "🇧🇪" },
  "Bosnia & Herzegovina": { code: "BIH", flag: "🇧🇦" },
  Brazil: { code: "BRA", flag: "🇧🇷" },
  Canada: { code: "CAN", flag: "🇨🇦" },
  "Cape Verde": { code: "CPV", flag: "🇨🇻" },
  Colombia: { code: "COL", flag: "🇨🇴" },
  "Congo DR": { code: "COD", flag: "🇨🇩" },
  Croatia: { code: "CRO", flag: "🇭🇷" },
  Ecuador: { code: "ECU", flag: "🇪🇨" },
  Egypt: { code: "EGY", flag: "🇪🇬" },
  England: { code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  France: { code: "FRA", flag: "🇫🇷" },
  Ghana: { code: "GHA", flag: "🇬🇭" },
  Mexico: { code: "MEX", flag: "🇲🇽" },
  Morocco: { code: "MAR", flag: "🇲🇦" },
  Norway: { code: "NOR", flag: "🇳🇴" },
  Paraguay: { code: "PAR", flag: "🇵🇾" },
  Portugal: { code: "POR", flag: "🇵🇹" },
  Senegal: { code: "SEN", flag: "🇸🇳" },
  Spain: { code: "ESP", flag: "🇪🇸" },
  Switzerland: { code: "SUI", flag: "🇨🇭" },
  USA: { code: "USA", flag: "🇺🇸" },
};

const FINISHED_STATES = new Set(["finished", "final", "ended", "complete", "completed"]);

function team(id: number, name: string): MatchTeam {
  const meta = TEAM_META[name];
  return {
    id,
    name,
    code: meta?.code ?? name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase(),
    flag: meta?.flag ?? "⚽",
  };
}

export function phaseForFixture(fixture: RawTxlineFixture, now = Date.now()): MatchPhase {
  const startTime = Number(fixture.StartTime);
  const gameState = String(fixture.GameState ?? "").toLowerCase();
  if (fixture.GameState === 3 || FINISHED_STATES.has(gameState)) return "past";
  if (!Number.isFinite(startTime) || startTime > now) return "upcoming";
  if (now <= startTime + 4 * 60 * 60 * 1000) return "live";
  return "past";
}

export function normalizeFixture(
  value: unknown,
  now = Date.now(),
): MatchCatalogItem | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as RawTxlineFixture;
  if (
    !Number.isInteger(raw.FixtureId)
    || !Number.isFinite(raw.StartTime)
    || !raw.Participant1
    || !raw.Participant2
  ) return null;

  const participantOne = team(raw.Participant1Id ?? 0, raw.Participant1);
  const participantTwo = team(raw.Participant2Id ?? 0, raw.Participant2);
  const participantOneIsHome = raw.Participant1IsHome !== false;

  return {
    fixtureId: raw.FixtureId as number,
    competition: raw.Competition ?? "Football",
    competitionId: raw.CompetitionId ?? 0,
    startTime: new Date(raw.StartTime as number).toISOString(),
    phase: phaseForFixture(raw, now),
    home: participantOneIsHome ? participantOne : participantTwo,
    away: participantOneIsHome ? participantTwo : participantOne,
  };
}

function scoreSide(raw: RawTxlineScore, participant: 1 | 2, participantOneIsHome: boolean) {
  const side = participant === 1 ? raw.Score?.Participant1 : raw.Score?.Participant2;
  const goals = Number(side?.Total?.Goals ?? 0);
  return {
    side: participantOneIsHome === (participant === 1) ? "home" as const : "away" as const,
    goals: Number.isFinite(goals) ? goals : 0,
  };
}

function latestBySeq(scores: RawTxlineScore[]) {
  return [...scores].sort((a, b) => Number(b.Seq ?? -1) - Number(a.Seq ?? -1))[0];
}

function eventKind(raw: RawTxlineScore): MatchTimelineEvent["kind"] | null {
  if (raw.Confirmed === false) return null;
  if (raw.Action === "goal") return "goal";
  if (raw.Action === "yellow_card") return "yellow_card";
  if (raw.Action === "red_card") return "red_card";
  if (raw.Action === "shot" && raw.Data?.Outcome === "OnTarget") return "shot_on_target";
  if (raw.Action === "corner") return "corner";
  return null;
}

const EVENT_LABELS: Record<MatchTimelineEvent["kind"], { icon: string; label: string }> = {
  goal: { icon: "⚽", label: "Goal" },
  yellow_card: { icon: "🟨", label: "Yellow card" },
  red_card: { icon: "🟥", label: "Red card" },
  shot_on_target: { icon: "🎯", label: "Shot on target" },
  corner: { icon: "🚩", label: "Corner" },
};

function phaseFromScores(
  fixture: RawTxlineFixture,
  scores: RawTxlineScore[],
  now: number,
): MatchPhase {
  if (scores.some((item) => item.Action === "game_finalised" || item.StatusId === 100)) return "past";
  const latest = latestBySeq(scores);
  if (latest?.Clock?.Running || scores.some((item) => item.StatusId === 2)) return "live";
  return phaseForFixture(fixture, now);
}

function playerNameMap(scores: RawTxlineScore[]) {
  const names = new Map<number, string>();
  for (const snapshot of scores) {
    for (const lineup of snapshot.Lineups ?? []) {
      for (const entry of lineup.lineups ?? []) {
        const rawId = (entry as RawLineupEntry & { fixturePlayerId?: number }).fixturePlayerId;
        const playerIds = [Number(rawId), Number(entry.player?.normativeId)];
        if (entry.player?.preferredName) {
          for (const playerId of playerIds) {
            if (Number.isFinite(playerId)) names.set(playerId, entry.player.preferredName);
          }
        }
      }
    }
  }
  return names;
}

function normalizeLineups(scores: RawTxlineScore[]): MatchLineup[] {
  const snapshot = scores.find((item) => Array.isArray(item.Lineups) && item.Lineups.length > 0);
  return (snapshot?.Lineups ?? []).map((lineup) => ({
    team: lineup.preferredName ?? "Team",
    starters: (lineup.lineups ?? [])
      .filter((entry) => entry.starter && entry.player?.preferredName)
      .map((entry) => entry.player?.preferredName as string),
  }));
}

export function normalizeMatchDetail(
  fixtureValue: unknown,
  scoreValue: unknown,
  oddsValue: unknown,
  now = Date.now(),
): MatchDetail | null {
  const fixture = fixtureValue as RawTxlineFixture;
  const match = normalizeFixture(fixtureValue, now);
  if (!match) return null;

  const scores = (Array.isArray(scoreValue) ? scoreValue : [])
    .filter((item): item is RawTxlineScore => Boolean(item && typeof item === "object"));
  const participantOneIsHome = fixture.Participant1IsHome !== false;
  const latest = latestBySeq(scores);
  const scoreSnapshot = [...scores]
    .sort((a, b) => Number(b.Seq ?? -1) - Number(a.Seq ?? -1))
    .find((item) => item.Score?.Participant1 || item.Score?.Participant2);
  const participantOne = scoreSnapshot ? scoreSide(scoreSnapshot, 1, participantOneIsHome) : null;
  const participantTwo = scoreSnapshot ? scoreSide(scoreSnapshot, 2, participantOneIsHome) : null;
  const names = playerNameMap(scores);

  const events = scores.flatMap((raw): MatchTimelineEvent[] => {
    const kind = eventKind(raw);
    if (!kind) return [];
    const participant = raw.Participant;
    const side = participant
      ? (participantOneIsHome === (participant === 1) ? "home" : "away")
      : null;
    const meta = EVENT_LABELS[kind];
    const player = Number.isFinite(raw.Data?.PlayerId) ? names.get(Number(raw.Data?.PlayerId)) : null;
    const teamName = side ? match[side].name : null;
    return [{
      id: `${match.fixtureId}-${raw.Id ?? raw.Seq ?? kind}-${kind}`,
      seq: Number(raw.Seq ?? 0),
      minute: Math.max(0, Math.floor(Number(raw.Clock?.Seconds ?? 0) / 60)),
      kind,
      icon: meta.icon,
      label: player ? `${meta.label} · ${player}` : meta.label,
      team: side,
      teamName,
      occurredAt: new Date(raw.Ts ?? Date.parse(match.startTime)).toISOString(),
    }];
  }).sort((a, b) => b.seq - a.seq).slice(0, 10);

  const homeGoals = participantOne?.side === "home" ? participantOne.goals : participantTwo?.goals;
  const awayGoals = participantOne?.side === "away" ? participantOne.goals : participantTwo?.goals;
  const participantOneCorners = Number(scoreSnapshot?.Score?.Participant1?.Total?.Corners ?? 0);
  const participantTwoCorners = Number(scoreSnapshot?.Score?.Participant2?.Total?.Corners ?? 0);
  const homeCorners = participantOneIsHome ? participantOneCorners : participantTwoCorners;
  const awayCorners = participantOneIsHome ? participantTwoCorners : participantOneCorners;
  const maxClockSeconds = scores.reduce(
    (maximum, item) => Math.max(maximum, Number(item.Clock?.Seconds ?? 0)),
    0,
  );
  const conditions = scores.flatMap((item) => item.Data?.Conditions ?? []);
  const lineups = normalizeLineups(scores);
  const odds = findBestMatchWinnerMarket(oddsValue, match.fixtureId);
  const phase = phaseFromScores(fixture, scores, now);

  return {
    ...match,
    phase,
    score: scoreSnapshot ? { home: homeGoals ?? 0, away: awayGoals ?? 0 } : null,
    minute: phase !== "upcoming" && scores.length ? Math.floor(maxClockSeconds / 60) : null,
    clockRunning: Boolean(latest?.Clock?.Running),
    events,
    lineups,
    odds,
    conditions: [...new Set(conditions)].slice(0, 5),
    stats: scoreSnapshot ? {
      home: { goals: homeGoals ?? 0, corners: homeCorners },
      away: { goals: awayGoals ?? 0, corners: awayCorners },
    } : null,
    coverage: {
      scores: Boolean(scoreSnapshot),
      odds: Boolean(odds),
      lineups: lineups.some((lineup) => lineup.starters.length > 0),
    },
    source: "TxLINE",
  };
}
