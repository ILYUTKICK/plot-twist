# PLOT TWIST — competitive interface review

## Judge verdict

PLOT TWIST should not compete on the number of widgets, statistics, or token
utilities. Its winning interaction is a single repeatable loop that starts from
a verified match moment and needs one tap from the fan:

```text
TxLINE event -> AI headline -> one free call -> automatic settlement -> XP -> optional Solana achievement
```

The interface should make that loop understandable before a judge reads any
technical explanation. The promise is now stated in Match Center as: **Turn any
live match into a story you can play.**

## Competitive benchmark

| Product | What its interface optimises | Where PLOT TWIST must be different |
| --- | --- | --- |
| [LiveLike](https://www.livelike.com/interactivity-gaming) | A wide library of polls, predictions, quizzes, quests, mini-games, chat, and leaderboards embedded into existing media products. | One signature live format instead of a widget catalogue. TxLINE events create the round automatically; a producer does not have to author every question. |
| [Monterosa](https://monterosa.co/) | A configurable engagement and loyalty platform where interactions feed first-party fan profiles and conversion flows. | A concrete fan experience that can be understood and played immediately. No account or CRM journey is required before the first call. |
| [Genius Sports Engage](https://www.geniussports.com/engage/) | Large-scale official-data activation, augmented broadcasts, audience acquisition, and commercial gamification. | Emotional, fan-facing storytelling rather than a marketing dashboard. The same verified event drives narrative, action, and settlement in one surface. |
| [OneFootball](https://onefootballsupport.zendesk.com/hc/en-us/articles/4412970161937-What-does-the-OneFootball-app-offer) | Fast discovery of live scores, statistics, news, video, and personalised football coverage. | Keep the score hierarchy familiar, then turn passive match data into a decision the fan can make now. |
| [Socios](https://www.socios.com/get-to-know-socios-com/) | Club loyalty, polls, predictions, rewards, and token-gated fan benefits. | The core game is free and has no token gate or wager. Solana appears only after participation as an optional, wallet-signed memory. |

## Interface decisions from the review

- Match Center leads with the consumer benefit, then the data provider.
- The header removes the fake profile affordance. It shows real session XP in
  Judge Mode and `FREE · NO WAGER` while browsing other matches.
- Prediction cards are available from the deterministic event context while
  Ollama writes the expressive headline; AI latency does not block the first tap.
- Every active round exposes one explicit `LOCKS AT mm:00` deadline.
- Upcoming fixtures never show an invented score, clock, or unlocked call.
- On mobile, the live call card appears before the narrative card so the fan can
  act immediately after reading the verified score.
- Keyboard focus is visible and motion respects `prefers-reduced-motion`.
- Cached verified fixtures remain selectable if a background catalog refresh
  fails.

## Defensible winning line

> Other products add widgets around the match. PLOT TWIST makes every verified
> match moment playable — AI narrates, TxLINE decides, and Solana remembers.

## What not to add before judging

- Do not add generic polls, chat, fantasy, or a fake global leaderboard merely to
  match larger platforms.
- Do not put wallet connection before the first fan call.
- Do not let Ollama generate facts, calls, XP, or settlement outcomes.
- Do not turn XP into financial value or describe a wallet Memo as TxLINE-signed.
- Do not hide missing data behind generated placeholders.
