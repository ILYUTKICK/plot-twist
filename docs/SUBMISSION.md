# Submission copy

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

## TxLINE usage

- `POST /auth/guest/start` — short-lived guest JWT
- `GET /api/scores/historical/{fixtureId}` — verified submitted replay
- `GET /api/odds/updates/{epochDay}/{hour}/{interval}` — historical market shift
- `GET /api/scores/stream` — production live score adapter
- `GET /api/odds/stream` — production live odds adapter
- `GET /api/odds/snapshot/{fixtureId}` — fixture odds snapshot adapter

## TxLINE API feedback

`FixtureId`, `Seq`, and `Ts` make cross-feed identity and replay ordering strong;
historical scores make a deterministic demo possible; and `PriceNames` with `Pct`
preserve participant mapping. Developer experience would improve with one complete
guest-JWT/API-token lifecycle example, explicit documentation of the finite SSE
framing returned by historical scores, a canonical fixture-to-team-name join, and
server-side fixture filters on the global live streams.

## Links

- Live app: add after deployment
- Public repository: https://github.com/ILYUTKICK/plot-twist
- Demo video: https://ilyutkick.github.io/plot-twist/
- Solana transaction: https://explorer.solana.com/tx/2XY2q4xJk9adgBEPXxR8bPXuvGmnNkipd4a7bSejrQXFxB1qq7KqUrMVjwJNat9V9zson4MHBeCVB6EQfjcDAZcM?cluster=devnet

## Final pre-submit checklist

- [ ] Public app opens in incognito and `/api/demo-readiness` is green
- [ ] Public repository contains README and no `.env.local`
- [x] Demo video is public and plays inline without sign-in
- [ ] Submission links point to the final production artifacts
- [ ] Technical description names the exact TxLINE endpoints
- [ ] TxLINE API feedback is included
- [ ] Wallet language says “wallet-signed achievement,” not “oracle proof”
- [ ] Submit before the listing closes and reopen the entry to verify it saved
