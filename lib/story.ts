import type { PredictionId, PredictionTarget, TeamSide } from "./match-events";

export type StoryCall = PredictionTarget & {
  label: string;
  detail: string;
  xp: number;
};

export type DirectedStory = {
  headlineLead: string;
  headlineAccent: string;
  explanation: string;
  recap: string;
  marketLabel: string;
  calls: StoryCall[];
  source: "ollama" | "fallback";
  model: string;
  latencyMs?: number;
};

export type StoryDirectorInput = {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  triggerTeam: string;
  trigger: "goal" | "yellow_card" | "red_card" | "shot_on_target" | "odds_shift";
  minute: number;
  deadlineMinute: number;
  homeScore: number;
  awayScore: number;
  marketBefore: number;
  marketAfter: number;
  marketVerified: boolean;
};

export const FALLBACK_STORY: DirectedStory = {
  headlineLead: "Belgium just changed",
  headlineAccent: "the entire story.",
  explanation: "The equalizer brings the match to 1–1 and opens a fresh decision window for fans watching the next ten minutes.",
  recap: "Belgium are level at 1–1 in the 40th minute. The next ten minutes now become a new chapter for every fan following the match.",
  marketLabel: "Belgium win probability",
  calls: [
    { id: "shot", fixtureId: 18218149, team: "home", label: "Spain shot on target", detail: "before 50:00", xp: 140 },
    { id: "card", fixtureId: 18218149, team: "home", label: "Spain yellow card", detail: "before 50:00", xp: 210 },
    { id: "goal", fixtureId: 18218149, label: "Another goal", detail: "before 50:00", xp: 330 },
  ],
  source: "fallback",
  model: "deterministic-template",
};

const XP: Record<PredictionId, number> = { shot: 140, card: 210, goal: 330 };

function focusTeamFor(input: StoryDirectorInput): { name: string; side: TeamSide } {
  const triggerSide = input.triggerTeam === input.homeTeam ? "home" : "away";
  if (input.trigger === "yellow_card" || input.trigger === "red_card") {
    return { name: input.triggerTeam, side: triggerSide };
  }
  return triggerSide === "home"
    ? { name: input.awayTeam, side: "away" }
    : { name: input.homeTeam, side: "home" };
}

function callsFor(input: StoryDirectorInput): StoryCall[] {
  const focusTeam = focusTeamFor(input);
  return [
    { id: "shot", fixtureId: input.fixtureId, team: focusTeam.side, label: `${focusTeam.name} shot on target`, detail: `before ${input.deadlineMinute}:00`, xp: XP.shot },
    { id: "card", fixtureId: input.fixtureId, team: focusTeam.side, label: `${focusTeam.name} yellow card`, detail: `before ${input.deadlineMinute}:00`, xp: XP.card },
    { id: "goal", fixtureId: input.fixtureId, label: "Another goal", detail: `before ${input.deadlineMinute}:00`, xp: XP.goal },
  ];
}

function eventLabelFor(input: StoryDirectorInput) {
  if (input.trigger === "goal" && input.homeScore === input.awayScore) return "verified equalizer";
  return `verified ${input.trigger.replaceAll("_", " ")}`;
}

function ordinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th"}`;
}

function factualRecapFor(input: StoryDirectorInput) {
  const score = `${input.homeScore}–${input.awayScore}`;
  if (input.trigger === "goal") {
    return `${input.triggerTeam} scored in the ${ordinal(input.minute)} minute. The score is now ${score}. Fans can call the next twist before ${input.deadlineMinute}:00.`;
  }
  if (input.trigger === "yellow_card") {
    return `${input.triggerTeam} received a yellow card in the ${ordinal(input.minute)} minute. The score remains ${score}. Fans can call the next twist before ${input.deadlineMinute}:00.`;
  }
  if (input.trigger === "red_card") {
    return `${input.triggerTeam} received a red card in the ${ordinal(input.minute)} minute. The score remains ${score}. Fans can call the next twist before ${input.deadlineMinute}:00.`;
  }
  if (input.trigger === "shot_on_target") {
    return `${input.triggerTeam} recorded a shot on target in the ${ordinal(input.minute)} minute. The score remains ${score}. Fans can call the next twist before ${input.deadlineMinute}:00.`;
  }
  return `The live match picture changed in the ${ordinal(input.minute)} minute with the score at ${score}. Fans can call the next twist before ${input.deadlineMinute}:00.`;
}

function hasUnsafeNarrative(value: string, input: StoryDirectorInput) {
  if (
    input.homeScore === input.awayScore
    && /\b(ahead|behind|in the lead|leads?|led|leading|trails?|trailed)\b/i.test(value)
  ) return true;
  if (
    /\b(well-placed|header|penalty|free kick|long-range|volley|striker|scorer|goalkeeper|captain|finish(?:ed|es)?)\b|back of (?:the )?net|finds? (?:the )?net/i.test(value)
  ) return true;
  if (/\b(probability|percent|odds|market)\b|\d+\s*%/i.test(value)) return true;
  return /\b(?:home|away) side\b|\bfinal (?:\w+\s){0,2}(?:minutes?|stretch)\b/i.test(value);
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  if (cleaned.length <= maxLength) return cleaned;
  const clipped = cleaned.slice(0, maxLength + 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > maxLength * 0.65 ? lastSpace : maxLength).trim()}…`;
}

export function finalizeDirectedStory(
  value: unknown,
  input: StoryDirectorInput,
  model: string,
  latencyMs: number,
): DirectedStory | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const headlineLead = cleanString(candidate.headlineLead, 52);
  const headlineAccent = cleanString(candidate.headlineAccent, 42);
  if (!headlineLead || !headlineAccent) return null;

  const headline = `${headlineLead} ${headlineAccent}`;
  if (hasUnsafeNarrative(headline, input)) return null;

  const verifiedMarketLine = input.marketVerified
    ? `TxLINE recorded ${input.triggerTeam}'s win probability moving from ${input.marketBefore}% to ${input.marketAfter}% after the ${eventLabelFor(input)}.`
    : `TxLINE confirmed the ${input.trigger.replaceAll("_", " ")} for ${input.triggerTeam} in the ${ordinal(input.minute)} minute.`;

  return {
    headlineLead,
    headlineAccent,
    explanation: `${verifiedMarketLine} The confirmed event creates a fresh decision point for every fan following the match.`,
    recap: factualRecapFor(input),
    marketLabel: input.marketVerified ? `${input.triggerTeam} win probability` : "Live event context",
    calls: callsFor(input),
    source: "ollama",
    model,
    latencyMs,
  };
}

export function fallbackFor(input: StoryDirectorInput): DirectedStory {
  const score = `${input.homeScore}–${input.awayScore}`;
  const copy = {
    goal: {
      headlineLead: `${input.triggerTeam} change the story`,
      headlineAccent: `The score is now ${score}.`,
      recap: factualRecapFor(input),
    },
    yellow_card: {
      headlineLead: `${input.triggerTeam} see yellow`,
      headlineAccent: "The temperature just changed.",
      recap: factualRecapFor(input),
    },
    red_card: {
      headlineLead: `${input.triggerTeam} are down a player`,
      headlineAccent: "The balance just broke.",
      recap: factualRecapFor(input),
    },
    shot_on_target: {
      headlineLead: `${input.triggerTeam} test the target`,
      headlineAccent: "Pressure enters the story.",
      recap: factualRecapFor(input),
    },
    odds_shift: {
      headlineLead: "The live picture just moved",
      headlineAccent: "A new chapter is forming.",
      recap: factualRecapFor(input),
    },
  }[input.trigger];
  return {
    ...FALLBACK_STORY,
    ...copy,
    explanation: input.marketVerified
      ? `TxLINE recorded ${input.triggerTeam}'s win probability moving from ${input.marketBefore}% to ${input.marketAfter}% after the ${eventLabelFor(input)}. A new fan decision window is open.`
      : `The verified ${input.trigger.replaceAll("_", " ")} opens a new decision window for fans.`,
    marketLabel: input.marketVerified ? `${input.triggerTeam} win probability` : "Live event context",
    calls: callsFor(input),
  };
}
