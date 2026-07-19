# Superteam submission form — ready to paste

## Link to Your Submission

```text
https://plot-twist-six.vercel.app
```

## Tweet Link

Optional. Leave blank until the public launch tweet is published, then paste its
URL here and in the X field below.

## Project Title

```text
PLOT TWIST
```

## Briefly explain your Project

```text
PLOT TWIST is a white-label second-screen football experience that turns verified TxLINE match events into free, contextual “what happens next?” fan calls. Deterministic rules settle every call from the same fixture feed and award non-financial XP, while Ollama narrates the moment, ElevenLabs voices the verified recap, and Solana preserves the completed session as a wallet-signed achievement. The product covers upcoming, live, and finished matches without wagers, payouts, or fabricated match data.
```

## Link to your live and working MVP

```text
https://plot-twist-six.vercel.app
```

## Link to Your Live Demo Video

```text
ADD FINAL PUBLIC LOOM OR UNLISTED YOUTUBE URL
```

## Project's Public Repository Link

```text
https://github.com/ILYUTKICK/plot-twist
```

## Project's Technical Documentation

```text
https://github.com/ILYUTKICK/plot-twist/blob/main/docs/TECHNICAL_DOCUMENTATION.md
```

## Project's X Profile or tweet

Optional. Use the same launch-tweet URL as the Tweet Link field, or leave blank.

## TxLINE API experience and feedback

```text
We especially liked TxLINE's FixtureId, Seq, and Ts fields because they make cross-feed identity, ordering, replay, and deduplication reliable. Historical score access made a deterministic judge demo possible, while PriceNames with Pct preserved market-participant mapping without inventing probabilities. The main friction was understanding the complete guest-JWT plus activation-token lifecycle, handling historical score responses that use SSE framing, joining score participants to canonical team display names, and locating the fixtureId filter contract for global live streams. One end-to-end authentication example, explicit finite-SSE documentation, and more prominent fixture-filter examples would materially improve developer onboarding.
```

## Anything Else?

```text
Judge path: open the production app, click JUDGE MODE, and run the verified Spain–Belgium historical replay for TxLINE fixture 18218149. Runtime readiness: https://plot-twist-six.vercel.app/api/demo-readiness

Existing wallet-signed Solana devnet achievement: https://explorer.solana.com/tx/2XY2q4xJk9adgBEPXxR8bPXuvGmnNkipd4a7bSejrQXFxB1qq7KqUrMVjwJNat9V9zson4MHBeCVB6EQfjcDAZcM?cluster=devnet

There is no wager, stake, payout, token reward, or promised financial value. AI narrates. TxLINE verifies. Solana remembers.
```

---

# Supporting long-form copy

## Project name

PLOT TWIST

## Tagline

AI narrates. TxLINE verifies. Solana remembers.

## Short description

PLOT TWIST is a white-label second-screen experience that turns verified football
events into free, contextual fan calls. TxLINE supplies the match truth, Ollama
writes the headline, deterministic rules settle each call, and Solana preserves a
wallet-signed fan achievement.

## Full description

Football broadcasts have more live data than ever, but the mainstream fan is
still mostly watching passively. Existing prediction products often introduce
betting friction, while score apps simply add more dashboards.

PLOT TWIST creates a lightweight participation loop around the match itself. A
verified goal, card, shot, or market movement becomes a short story beat and
three free “what happens next?” calls. The fan chooses one, watches the source
event settle it automatically, earns XP, builds a streak, and competes in a
friends room. No stake, payout, token, or financial promise is involved.

The submitted demo replays verified TxLINE data from Spain–Belgium
(`fixtureId 18218149`) in a judge-friendly compressed timeline. It preserves the
original fixture, event order, minute, team, score, sequence, and event IDs. It
also displays a same-fixture historical 1X2 movement around Belgium’s equalizer.

Ollama Cloud acts only as the expressive layer: it writes the two-part headline
from verified context. Server code owns the factual recap, call targets,
deadlines, XP, and resolution. Invalid or unsafe output falls back to a safe
template, so the LLM cannot decide who wins.

After two resolved calls, a fan can approve a Solana devnet Memo containing the
fixture, event IDs, calls, and session XP. The UI trusts it only after a server
`getTransaction` check validates the successful transaction, signer, Memo
Program, payload, fixture, event IDs, and XP. This is deliberately described as
a wallet-signed fan achievement—not as a TxLINE-signed oracle proof.

The commercial model is B2B2C: broadcasters, clubs, tournament apps, and fan
platforms license PLOT TWIST per tournament or active fan, then monetize sponsored
story rounds, loyalty programs, and aggregate engagement analytics. Fans continue
to participate for free.

The product now covers the full fixture lifecycle. Upcoming matches show only
published preview data and keep calls locked. Every live match immediately gets
a deterministic call round from its verified score and clock; confirmed actions
then trigger Ollama headlines. Fixture-scoped TxLINE score SSE creates and settles
the rounds, persists accuracy/XP per fixture, and deduplicates reconnects. When
TxLINE finalises the game, calls close
and the same screen becomes a final score, corners, event archive, and personal
fan-session summary. The Spain–Belgium historical replay remains the stable judge
path, not the limit of the product engine.

## TxLINE usage

- `POST /auth/guest/start` — short-lived guest JWT
- `GET /api/fixtures/snapshot` — finished/live/upcoming World Cup catalog
- `GET /api/scores/snapshot/{fixtureId}` — phase, clock, score, events, lineups, conditions
- `GET /api/scores/historical/{fixtureId}` — verified submitted replay
- `GET /api/odds/updates/{epochDay}/{hour}/{interval}` — historical market shift
- `GET /api/scores/stream?fixtureId=…` — fixture-scoped live round/settlement feed
- `GET /api/odds/stream?fixtureId=…` — fixture-scoped live odds adapter
- `GET /api/odds/snapshot/{fixtureId}` — fixture odds snapshot adapter

## TxLINE API feedback

`FixtureId`, `Seq`, and `Ts` make cross-feed identity and replay ordering strong;
historical scores make a deterministic demo possible; and `PriceNames` with `Pct`
preserve participant mapping. Developer experience would improve with one complete
guest-JWT/API-token lifecycle example, explicit documentation of the finite SSE
framing returned by historical scores, a canonical fixture-to-team-name join, and
server-side fixture filters on the global live streams.

## Links

- Live app: https://plot-twist-six.vercel.app
- Public repository: https://github.com/ILYUTKICK/plot-twist
- Technical documentation: https://github.com/ILYUTKICK/plot-twist/blob/main/docs/TECHNICAL_DOCUMENTATION.md
- Demo video: **ADD FINAL LOOM OR UNLISTED YOUTUBE URL AFTER RECORDING**
- Solana transaction: https://explorer.solana.com/tx/2XY2q4xJk9adgBEPXxR8bPXuvGmnNkipd4a7bSejrQXFxB1qq7KqUrMVjwJNat9V9zson4MHBeCVB6EQfjcDAZcM?cluster=devnet

## Final pre-submit checklist

- [ ] Public app opens in incognito and `/api/demo-readiness` is green
- [ ] Public repository contains README and no `.env.local`
- [ ] Demo video is public and plays inline without sign-in
- [ ] Submission links point to the final production artifacts
- [x] Technical description names the exact TxLINE endpoints
- [x] TxLINE API feedback is included
- [x] Wallet language says “wallet-signed achievement,” not “oracle proof”
- [ ] Submit before the listing closes and reopen the entry to verify it saved
