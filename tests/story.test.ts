import assert from "node:assert/strict";
import test from "node:test";
import { finalizeDirectedStory, type StoryDirectorInput } from "../lib/story.ts";

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
