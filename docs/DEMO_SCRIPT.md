# PLOT TWIST — 3-minute submission demo

This version is designed to satisfy the TxLINE screening requirements: it states
the problem, walks through the working production app, explains how TxLINE powers
the backend, and closes with the business case. Read the English voiceover
verbatim at a calm pace.

## Tabs to prepare

1. Production app: https://plot-twist-six.vercel.app
2. Backend readiness: https://plot-twist-six.vercel.app/api/demo-readiness
3. Existing Solana devnet transaction:
   https://explorer.solana.com/tx/2XY2q4xJk9adgBEPXxR8bPXuvGmnNkipd4a7bSejrQXFxB1qq7KqUrMVjwJNat9V9zson4MHBeCVB6EQfjcDAZcM?cluster=devnet

Record at 1920×1080 with browser zoom at 90–100%. Keep the production URL
visible at the beginning so judges immediately know this is a working app.

## Shot list and exact voiceover

| Time | Screen action | Voiceover |
| --- | --- | --- |
| 0–12s | Start on the production hero with the URL visible. Move the cursor across the verified story and fan-call card. | “Football fans have more live data than ever, but most of it never becomes participation. Score apps remain passive, while prediction products usually introduce betting friction.” |
| 12–27s | Scroll enough to show the free calls, XP, streak, and friends room. | “PLOT TWIST transforms verified match moments into free, contextual what-happens-next calls. There is no wager, payout, token, or promised financial return—only experience points, streaks, and fan identity.” |
| 27–45s | Open `MATCH CENTER`. Show Finished, Live now, and Upcoming, open the selector, then return to Spain–Belgium. | “This is a working production app. Match Center loads World Cup fixtures from TxLINE and follows the full lifecycle: published previews before kickoff, interactive calls during live coverage, and final statistics with a personal session summary.” |
| 45–61s | Open `/api/demo-readiness`; point to TxLINE, Ollama, and Solana as `ready`, then return to the app. | “The backend keeps every credential server-side and uses TxLINE fixture snapshots, score snapshots, historical scores, odds updates, and a fixture-scoped score stream. The browser receives only normalized match data.” |
| 61–76s | Open `JUDGE MODE`. Wait for three green checks, show fixture ID `18218149` and `HISTORICAL REPLAY`, then click `Start clean pitch`. | “For a reliable judge path, Judge Mode replays verified Spain–Belgium fixture one-eight-two-one-eight-one-four-nine. It preserves the original event order, minute, team, score, sequence, and TxLINE event IDs.” |
| 76–91s | Select `Spain yellow card`, lock it, and click `Start verified replay`. | “I call a Spain yellow card before the verified deadline. The choice is free, scoped to this fixture, and worth experience points—not money.” |
| 91–108s | Let the replay reach 42′. Point to the successful settlement, TxLINE event, streak, and XP. | “At minute forty-two, the original TxLINE yellow-card event settles my call automatically. Deterministic rules—not the AI—verify the fixture, team, event type, and deadline before awarding XP.” |
| 108–124s | Show the new headline and the `OLLAMA HEADLINE` label. Hover over the new calls. | “That confirmed event opens a fresh story round. Ollama writes only the emotional headline. The factual recap, available calls, deadline, winner, and XP remain controlled by deterministic server rules.” |
| 124–138s | Say the line, click `Hear the verified recap`, then stop talking and let roughly 8–10 seconds of ElevenLabs audio play. | “ElevenLabs turns the verified recap into natural match audio, while the API key remains on the server. Now listen to the verified recap.” |
| 138–153s | Select and lock `Spain shot on target`; let the replay reach 60′ and show `2/2`. | “The next verified event resolves a second fixture-scoped call, producing a two-for-two session and showing the complete repeatable engagement loop.” |
| 153–166s | Show the Solana achievement section, then switch to the prepared Explorer transaction. | “The fan can preserve the completed session as a wallet-signed Solana achievement. Server-side RPC verification checks the signer, fixture, TxLINE event IDs, calls, and XP.” |
| 166–178s | Return to the commercial strip/tagline and stop moving the cursor. | “Broadcasters, clubs, and tournament apps can license PLOT TWIST as a white-label fan layer. AI narrates. TxLINE verifies. Solana remembers.” |

Target duration: **about 2 minutes 58 seconds**, including the ElevenLabs audio sample. Anything below five minutes is valid;
clarity is more important than rushing to exactly two minutes.

## What the video proves

- **Problem:** mainstream football viewing is passive; betting and dense data
  dashboards add friction.
- **Working app:** judges see the public production URL and interact with the
  Match Center, story round, calls, settlement, XP, and achievement.
- **TxLINE backend:** the video shows live readiness and explains guest auth,
  server-side credentials, normalized fixtures, scores, events, and odds.
- **Business and technical value:** the closing explains the B2B2C white-label
  model and the deterministic AI safety boundary.

## Recording checklist

- Open the production app in an incognito window and confirm it loads without a
  Vercel sign-in screen.
- Open `/api/demo-readiness` immediately before recording; TxLINE, Ollama, and
  Solana must all report `ready`.
- Confirm Match Center has loaded before recording; return to Spain–Belgium before
  starting Judge Mode.
- Use the same Solana devnet wallet that owns the existing achievement, or show
  the prepared Explorer transaction if a fresh wallet confirmation is slow.
- Keep at least `0.01 SOL` in the demo wallet if stamping a new achievement.
- When demonstrating ElevenLabs, finish your sentence before clicking the audio
  button and do not speak over the generated recap.
- Never show `.env.local`, Vercel settings, API tokens, wallet seed phrases, or
  browser extension internals.
- Do not call the Memo a “TxLINE proof” or “TxLINE-signed proof.” Say
  **wallet-signed Solana achievement**.
- Show fixture ID `18218149`, `HISTORICAL REPLAY`, and at least one verified event
  settlement clearly.
- End on the B2B2C licensing model rather than implementation details.
- Export at 1080p and verify audio, cursor visibility, and text readability.
- Upload the final video to **YouTube as Unlisted** or to **Loom**. Test the link in
  incognito before adding it to the submission.
- Put the production URL and public repository in the video description.

## Suggested video title and description

**Title**

`PLOT TWIST — TxLINE Consumer & Fan Experience Demo`

**Description**

```text
PLOT TWIST turns verified football events into free, playable fan calls.

Live app: https://plot-twist-six.vercel.app
Source: https://github.com/ILYUTKICK/plot-twist

AI narrates. TxLINE verifies. Solana remembers.
```
