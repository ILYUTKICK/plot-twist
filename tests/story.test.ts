import assert from "node:assert/strict";
import test from "node:test";
import { fallbackFor, finalizeDirectedStory, type StoryDirectorInput } from "../lib/story.ts";

const input: StoryDirectorInput = {
  fixtureId: 18218149,
  homeTeam: "Spain",
  awayTeam: "Belgium",
  triggerTeam: "Belgium",
  trigger: "goal",
  minute: 40,
  deadlineMinute: 50,
  homeScore: 1,
  awayScore: 1,
  marketBefore: 4.6,
  marketAfter: 13.1,
  marketVerified: true,
};

test("keeps model control limited to the headline", () => {
  const story = finalizeDirectedStory({
    headlineLead: "Belgium change the story",
    headlineAccent: "Everything feels open.",
    calls: [{ id: "goal", fixtureId: 999, xp: 999_999 }],
    recap: "Invented model recap",
  }, input, "gpt-oss:20b", 420);

  assert.ok(story);
  assert.equal(story.source, "ollama");
  assert.equal(story.calls.length, 3);
  assert.deepEqual(story.calls.map((call) => call.fixtureId), [18218149, 18218149, 18218149]);
  assert.deepEqual(story.calls.map((call) => call.xp), [140, 210, 330]);
  assert.match(story.recap, /Belgium scored in the 40th minute/);
  assert.doesNotMatch(story.recap, /Invented/);
});

test("rejects an unsafe headline when the score is level", () => {
  assert.equal(finalizeDirectedStory({
    headlineLead: "Belgium are ahead",
    headlineAccent: "Spain now trail.",
  }, input, "gpt-oss:20b", 420), null);
});

test("rejects a headline that mistakes the call deadline for match time remaining", () => {
  assert.equal(finalizeDirectedStory({
    headlineLead: "Spain see yellow",
    headlineAccent: "60 minutes to go",
  }, input, "gpt-oss:20b", 420), null);
});

test("opens an honest fixture-scoped round when a live match has no recent key event", () => {
  const liveInput: StoryDirectorInput = {
    ...input,
    fixtureId: 18257865,
    homeTeam: "France",
    awayTeam: "England",
    triggerTeam: "France",
    trigger: "live_state",
    minute: 64,
    deadlineMinute: 74,
    homeScore: 2,
    awayScore: 4,
    marketBefore: 0,
    marketAfter: 0,
    marketVerified: false,
  };

  const fallback = fallbackFor(liveInput);
  assert.match(fallback.explanation, /TxLINE confirms France against England is live/);
  assert.doesNotMatch(fallback.explanation, /verified match started/);
  assert.deepEqual(fallback.calls.map((call) => call.fixtureId), [18257865, 18257865, 18257865]);
  assert.deepEqual(fallback.calls.map((call) => call.detail), ["before 74:00", "before 74:00", "before 74:00"]);

  const directed = finalizeDirectedStory({
    headlineLead: "France versus England",
    headlineAccent: "The live chapter is open.",
  }, liveInput, "gpt-oss:20b", 420);

  assert.ok(directed);
  assert.match(directed.explanation, /64th minute at 2–4/);
  assert.doesNotMatch(directed.explanation, /confirmed the match started/);

  assert.equal(finalizeDirectedStory({
    headlineLead: "France starts the 64th minute",
    headlineAccent: "England hold the score.",
  }, liveInput, "gpt-oss:20b", 420), null);
  assert.equal(finalizeDirectedStory({
    headlineLead: "England edge France 4-3",
    headlineAccent: "England takes the lead.",
  }, liveInput, "gpt-oss:20b", 420), null);
  assert.equal(finalizeDirectedStory({
    headlineLead: "England remain ahead 5-2",
    headlineAccent: "France are trailing.",
  }, liveInput, "gpt-oss:20b", 420), null);
  assert.equal(finalizeDirectedStory({
    headlineLead: "England remain ahead in the 68th minute",
    headlineAccent: "France are trailing.",
  }, liveInput, "gpt-oss:20b", 420), null);
});
