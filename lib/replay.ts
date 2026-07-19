import type { MatchEvent } from "./match-events";

export type ReplayFrame = MatchEvent & { delayMs: number };

export const DEMO_MATCH = {
  fixtureId: 18218149,
  competition: "World Cup",
  home: { name: "Spain", code: "ESP", flag: "🇪🇸" },
  away: { name: "Belgium", code: "BEL", flag: "🇧🇪" },
  mode: "verified-historical-replay",
} as const;

export const DEMO_FIXTURE_ID = DEMO_MATCH.fixtureId;
export const DEMO_START_MINUTE = 40;
export const DEMO_DEADLINE_MINUTE = 50;

// Offline fallback based on confirmed events from the TxLINE historical feed for
// Spain–Belgium. The app replaces this with a fresh API response when available.
export const DEMO_FALLBACK: ReplayFrame[] = [
  {
    delayMs: 1600,
    id: "18218149-404-yellow_card",
    fixtureId: DEMO_FIXTURE_ID,
    seq: 440,
    kind: "yellow_card",
    minute: 42,
    team: "home",
    homeScore: 1,
    awayScore: 1,
    occurredAt: "2026-07-10T19:43:17.949Z",
    source: "replay",
  },
  {
    delayMs: 17600,
    id: "18218149-634-shot_on_target",
    fixtureId: DEMO_FIXTURE_ID,
    seq: 702,
    kind: "shot_on_target",
    minute: 60,
    team: "home",
    homeScore: 1,
    awayScore: 1,
    occurredAt: "2026-07-10T20:22:48.268Z",
    source: "replay",
  },
];

type ReplayResponse = { events?: ReplayFrame[] };

const DEMO_EVENT_IDS = new Set(DEMO_FALLBACK.map((event) => event.id));

export function selectDemoReplayFrames(events: ReplayFrame[]): ReplayFrame[] {
  return events
    .filter((event) => DEMO_EVENT_IDS.has(event.id))
    .sort((a, b) => a.seq - b.seq)
    // The two known events are separated enough for the judge to lock round two.
    .map((event, index) => ({ ...event, delayMs: 1600 + index * 16000 }));
}

export async function loadVerifiedDemoReplay(): Promise<ReplayFrame[]> {
  const response = await fetch(`/api/txline/replay/${DEMO_FIXTURE_ID}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Replay request failed (${response.status})`);
  const data = (await response.json()) as ReplayResponse;

  const windowEvents = selectDemoReplayFrames(data.events ?? []);

  if (!windowEvents.length) throw new Error("Replay contains no events in the demo window");
  return windowEvents;
}
