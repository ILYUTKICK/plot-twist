import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeFixture,
  normalizeMatchDetail,
  phaseForFixture,
  type RawTxlineFixture,
} from "../lib/matches.ts";

const START = Date.parse("2026-07-18T21:00:00.000Z");
const fixture: RawTxlineFixture = {
  FixtureId: 18257865,
  StartTime: START,
  Competition: "World Cup",
  CompetitionId: 72,
  Participant1Id: 1999,
  Participant1: "France",
  Participant2Id: 1888,
  Participant2: "England",
  Participant1IsHome: true,
  GameState: 1,
};

test("groups fixtures into past, live and upcoming using the real kickoff window", () => {
  assert.equal(phaseForFixture(fixture, START - 1), "upcoming");
  assert.equal(phaseForFixture(fixture, START + 60 * 60 * 1000), "live");
  assert.equal(phaseForFixture(fixture, START + 5 * 60 * 60 * 1000), "past");
  assert.equal(phaseForFixture({ ...fixture, GameState: 3 }, START - 1), "past");
});

test("normalizes teams, country metadata and home-away order", () => {
  const match = normalizeFixture(fixture, START + 1);
  assert.ok(match);
  assert.deepEqual(match.home, { id: 1999, name: "France", code: "FRA", flag: "🇫🇷" });
  assert.deepEqual(match.away, { id: 1888, name: "England", code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" });
});

test("live score actions override a stale scheduled game state", () => {
  const scores = [
    {
      FixtureId: 18257865,
      Action: "lineups",
      Seq: 3,
      Lineups: [{
        preferredName: "England",
        lineups: [{
          fixturePlayerId: 840914,
          starter: true,
          player: { normativeId: 1069227, preferredName: "Saka, Bukayo" },
        }],
      }],
    },
    {
      FixtureId: 18257865,
      Action: "goal",
      Id: 533,
      Seq: 576,
      Ts: START + 47 * 60 * 1000,
      Confirmed: true,
      StatusId: 2,
      Participant: 2,
      Participant1IsHome: true,
      Clock: { Running: true, Seconds: 45 * 60 },
      Score: {
        Participant1: { Total: { Goals: 0 } },
        Participant2: { Total: { Goals: 4 } },
      },
      Data: { PlayerId: 1069227 },
    },
  ];
  const odds = [{
    FixtureId: 18257865,
    MessageId: "odds-1",
    Ts: START,
    SuperOddsType: "1X2_PARTICIPANT_RESULT",
    InRunning: true,
    MarketPeriod: null,
    PriceNames: ["part1", "draw", "part2"],
    Prices: [130000, 42200, 1032],
    Pct: ["0.769", "2.370", "96.899"],
  }];

  const match = normalizeMatchDetail(fixture, scores, odds, START + 48 * 60 * 1000);
  assert.ok(match);
  assert.equal(match.phase, "live");
  assert.deepEqual(match.score, { home: 0, away: 4 });
  assert.equal(match.minute, 45);
  assert.equal(match.events[0]?.teamName, "England");
  assert.match(match.events[0]?.label ?? "", /Saka, Bukayo/);
  assert.equal(match.lineups[0]?.starters[0], "Saka, Bukayo");
  assert.equal(match.odds?.awayPct, 96.899);
  assert.deepEqual(match.stats, {
    home: { goals: 0, corners: 0 },
    away: { goals: 4, corners: 0 },
  });
});

test("future fixtures never invent a score or coverage", () => {
  const match = normalizeMatchDetail(fixture, [{ Action: "weather", Seq: 1 }], [], START - 1);
  assert.ok(match);
  assert.equal(match.phase, "upcoming");
  assert.equal(match.score, null);
  assert.equal(match.minute, null);
  assert.equal(match.coverage.scores, false);
  assert.equal(match.coverage.odds, false);
});
