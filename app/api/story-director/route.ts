import { NextResponse } from "next/server";
import { directStory } from "@/lib/ollama";
import type { StoryDirectorInput } from "@/lib/story";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function validInput(value: unknown): value is StoryDirectorInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return Number.isInteger(input.fixtureId)
    && typeof input.homeTeam === "string"
    && typeof input.awayTeam === "string"
    && typeof input.triggerTeam === "string"
    && ["match_started", "live_state", "goal", "yellow_card", "red_card", "shot_on_target", "corner", "odds_shift"].includes(String(input.trigger))
    && Number.isInteger(input.minute)
    && Number.isInteger(input.deadlineMinute)
    && typeof input.homeScore === "number"
    && typeof input.awayScore === "number"
    && typeof input.marketBefore === "number"
    && Number.isFinite(input.marketBefore)
    && input.marketBefore >= 0
    && input.marketBefore <= 100
    && typeof input.marketAfter === "number"
    && Number.isFinite(input.marketAfter)
    && input.marketAfter >= 0
    && input.marketAfter <= 100
    && typeof input.marketVerified === "boolean";
}

export async function POST(request: Request) {
  try {
    const input: unknown = await request.json();
    if (!validInput(input)) {
      return NextResponse.json({ error: "Invalid story context" }, { status: 400 });
    }

    const story = await directStory(input);
    return NextResponse.json(story, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch {
    return NextResponse.json({ error: "Story Director request failed" }, { status: 500 });
  }
}
