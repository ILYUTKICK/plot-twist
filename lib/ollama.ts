import {
  fallbackFor,
  finalizeDirectedStory,
  type DirectedStory,
  type StoryDirectorInput,
} from "./story";

type OllamaResponse = {
  message?: { content?: string };
};

const cache = new Map<string, DirectedStory>();
const PROMPT_VERSION = 11;

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(withoutFence);
}

function promptFor(input: StoryDirectorInput): string {
  const narrativeContext = {
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    triggerTeam: input.triggerTeam,
    trigger: input.trigger,
    minute: input.minute,
    currentScore: `${input.homeScore}-${input.awayScore}`,
  };
  return [
    "You are PLOT TWIST, an energetic but factual football story director.",
    "Turn one verified match event into a concise two-part headline for mainstream fans.",
    "Never invent player names or facts. Never mention gambling, betting, money, crypto, APIs, or data providers.",
    "Describe only the event type, minute, score, teams, and probabilities explicitly supplied below.",
    "Do not describe how a goal was scored. Do not invent shots, passes, players, formations, match history, or tactics as facts.",
    "Do not mention any player or player role such as striker, scorer, goalkeeper, or captain.",
    "Always use the supplied team names. Never say home side or away side.",
    "If the scores are equal, neither team is ahead or leading. Say the score is level.",
    "Never state or infer the score before the supplied event and never say a team previously led or trailed.",
    "The prediction deadline is not the end of the match. Never call it the final minutes, final stretch, or full time.",
    "Write from the immediate moment after the verified event; do not recap anything that happened before it.",
    "Use the supplied probabilities only as market sentiment, not as certainty.",
    "Do not mention probabilities, percentages, odds, or market movement in any field; the server adds the verified market sentence.",
    "Interpret the trigger literally: match_started is the verified kickoff; live_state is only the current verified live clock and score; a card is only a card, a shot on target is only a shot on target, a corner is only a corner, and a goal is only a goal.",
    "For live_state, never say the match or a team started, began, kicked off, or entered the supplied minute.",
    "For live_state, describe only the current state. Never imply a change such as took the lead, moved ahead, fell behind, drew level, equalized, or changed the match.",
    "Allowed factual claims are only the supplied trigger, trigger team, minute, and current score.",
    "Return only a JSON object. No markdown and no text outside JSON.",
    "The object must contain exactly two strings: headlineLead and headlineAccent.",
    "Keep headlineLead under 52 characters and headlineAccent under 42 characters.",
    `Verified event context: ${JSON.stringify(narrativeContext)}`,
  ].join("\n");
}

export async function directStory(input: StoryDirectorInput): Promise<DirectedStory> {
  // A periodic live snapshot is verified context, not a narrative event. Keep it
  // instant and deterministic; Ollama only narrates confirmed match actions.
  if (input.trigger === "live_state") return fallbackFor(input);

  const apiKey = process.env.OLLAMA_API_KEY;
  const model = process.env.OLLAMA_MODEL ?? "gpt-oss:20b";
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? "https://ollama.com/api").replace(/\/$/, "");
  if (!apiKey) return fallbackFor(input);

  const cacheKey = JSON.stringify({ promptVersion: PROMPT_VERSION, model, input });
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: promptFor(input) }],
        stream: false,
        think: "low",
        options: { temperature: 0.2, num_predict: 800 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) throw new Error(`Ollama request failed (${response.status})`);
    const data = (await response.json()) as OllamaResponse;
    if (!data.message?.content) throw new Error("Ollama returned no message content");

    const story = finalizeDirectedStory(
      parseJsonContent(data.message.content),
      input,
      model,
      Date.now() - startedAt,
    );
    if (!story) throw new Error("Ollama output failed semantic validation");
    cache.set(cacheKey, story);
    return story;
  } catch (error) {
    console.warn(
      "[StoryDirector] Ollama fallback:",
      error instanceof Error ? error.message : "unknown error",
    );
    return fallbackFor(input);
  }
}
