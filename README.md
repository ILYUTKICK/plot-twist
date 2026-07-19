# PLOT TWIST

PLOT TWIST turns verified football events into short, free fan challenges. TxLINE
supplies the match truth, Ollama narrates the moment, deterministic rules resolve
each call, and a fan can stamp the completed session as a wallet-signed Solana
achievement.

The submitted demo uses a **verified historical replay** of Spain–Belgium
(`fixtureId 18218149`). It compresses the original timestamps for a judge-friendly
run while preserving event order, match minute, score, team, and TxLINE event ID.
The same pipeline can consume TxLINE's live score and odds streams in production.

The match center also loads the real World Cup fixture catalog and groups it into
finished, live, and upcoming matches. Selecting a fixture replaces the demo view
with every currently available TxLINE detail: score and clock, key events, 1X2
market signal, conditions, and starting lineups. Missing coverage is shown as
unavailable rather than filled with generated data. The Spain–Belgium fixture
remains the deterministic 60-second Judge Mode.

### Match lifecycle

| Phase | Fan experience |
| --- | --- |
| Upcoming | Verified kickoff, teams, published lineups/conditions, and pre-match 1X2. Calls stay locked until TxLINE confirms live coverage. |
| Live | Every live fixture gets an immediate verified-state call round. Confirmed goals, cards, shots on target, and corners then trigger Ollama story headlines and fresh rounds. One free call is settled only by a same-fixture event/team or the verified clock deadline. |
| Finished | Calls close. The UI switches to final score/corners, the available TxLINE event archive, personal accuracy, XP, best streak, and wallet achievement state. |

Settled fan sessions are stored per fixture in the browser. The server filters
both score and odds streams by `fixtureId`, while event IDs are deduplicated on
the client so reconnects cannot award XP twice.

## Why it is a consumer experience

Most live-data products show fans more numbers. PLOT TWIST converts those numbers
into a repeatable participation loop:

```text
verified event -> narrated plot twist -> free fan call -> automatic resolution -> XP -> achievement
```

There is no wager, stake, payout, token, or promised financial value. The product
is a second-screen engagement and loyalty layer.

## 60-second judge flow

1. Click `JUDGE MODE`, wait for the three green checks, then press `Start clean pitch`.
2. Lock `Spain yellow card` and start the verified replay.
3. TxLINE resolves the call at 42′; Ollama writes the next round's headline.
4. Lock `Spain shot on target`; TxLINE resolves it at 60′.
5. Connect a Wallet Standard wallet and click `Stamp achievement on Solana`.
6. After server-side RPC verification, open the transaction in Solana Explorer.

Closing line: **AI narrates. TxLINE verifies. Solana remembers.**

`Hear verified match recap` uses the browser Web Speech API. It is text-to-speech,
not a generated clone voice, and needs no additional API key.

## What is real in the demo

- TxLINE historical score data for Spain–Belgium (`fixtureId 18218149`)
- A Belgium equalizer event followed by Spain yellow-card and shot-on-target events
- Same-fixture historical 1X2 market movement around the equalizer: `4.6% -> 13.1%`
- Ollama Cloud (`gpt-oss:20b`) narrative generation with a safe local fallback
- Fixture-, team-, event-, and deadline-aware deterministic call resolution
- Wallet Standard connection and wallet-approved Solana devnet Memo transaction
- Server-side `getTransaction` verification of signature, signer, Memo, fixture,
  event IDs, call count, and XP before the UI trusts an achievement
- Readiness checks for TxLINE, Ollama, and Solana devnet

Existing verified devnet achievement:
[open transaction in Solana Explorer](https://explorer.solana.com/tx/2XY2q4xJk9adgBEPXxR8bPXuvGmnNkipd4a7bSejrQXFxB1qq7KqUrMVjwJNat9V9zson4MHBeCVB6EQfjcDAZcM?cluster=devnet).

## AI boundary

Ollama controls expressive copy: the emotional two-part headline. It
does **not** decide which calls are offered, who won, the XP amount, or any match
fact. The server validates the model output and replaces factual recap, market
sentence, choices, deadlines, and XP with deterministic values. Unsafe or invalid
output falls back to a deterministic template.

Quiet live periods use the deterministic verified-state template directly: there
is no narrative event for Ollama to embellish, but fans still receive fixture-
scoped cards immediately. Ollama is invoked only for confirmed match actions.

This boundary keeps the product lively without putting an LLM in the scoring path:

```text
TxLINE score/odds payload
  -> normalized MatchEvent
  -> deterministic trigger + call builder
     -> Ollama headline only
     -> deterministic resolver + XP
     -> browser SpeechSynthesis (optional)
     -> wallet-approved Solana achievement Memo
  -> server RPC verifier -> trusted achievement UI
```

## TxLINE integration

Credentials stay server-side. The adapter obtains a short-lived guest JWT,
retries once after `401/403`, sends the activation API token separately, and
normalizes upstream payloads before they reach the UI.

Exact upstream endpoints used by the project:

| Method | TxLINE endpoint | Use |
| --- | --- | --- |
| `POST` | `/auth/guest/start` | Obtain guest JWT |
| `GET` | `/api/fixtures/snapshot` | Past, live, and upcoming match catalog |
| `GET` | `/api/scores/snapshot/{fixtureId}` | Selected fixture state, key events, conditions, and lineups |
| `GET` | `/api/scores/historical/{fixtureId}` | Submitted verified replay |
| `GET` | `/api/odds/updates/{epochDay}/{hour}/{interval}` | Submitted historical market shift |
| `GET` | `/api/scores/stream?fixtureId=…` | Fixture-scoped live event and settlement feed |
| `GET` | `/api/odds/stream?fixtureId=…` | Fixture-scoped live odds adapter |
| `GET` | `/api/odds/snapshot/{fixtureId}` | Fixture market snapshot adapter |

Internal routes such as `/api/matches`, `/api/matches/{fixtureId}`, and
`/api/txline/replay/18218149` proxy and normalize those calls; browser code never
receives `TXLINE_API_TOKEN` or the guest JWT.

### TxLINE API feedback

What worked well:

- `FixtureId`, `Seq`, and `Ts` make replay ordering and cross-feed identity clear.
- Historical scores make a deterministic, judge-safe demo possible.
- `PriceNames` plus `Pct` preserve participant mapping without deriving a fake
  probability from decimal prices.

What would improve developer experience:

- Document the lifetime and renewal contract for both guest JWT and activation
  token together, with one end-to-end server example.
- Return historical scores as documented JSON or document explicitly that the
  response uses SSE framing even though it is a finite replay.
- Include team display names in score events, or publish a canonical fixture join
  example for mapping participant sides to names.
- Make the documented `fixtureId` stream filter more prominent and include it in
  the canonical SSE example; it is essential for safe per-match fan sessions.

## Solana achievement verification

The Memo is a wallet-signed fan achievement, not a cryptographic proof that
TxLINE itself signed the events. It contains a versioned compact record with the
fixture, resolved TxLINE event IDs, calls, XP, wallet, network, and issue time.

`GET /api/solana/achievement/{signature}?wallet=...&fixtureId=...` calls Solana
devnet `getTransaction` with `jsonParsed`, then checks:

- the transaction succeeded and its first signature matches the requested one;
- the expected wallet is the transaction signer and matches the Memo wallet;
- the instruction belongs to the Memo Program;
- the versioned payload, fixture, event-ID prefixes, call uniqueness, and XP sum
  pass strict validation.

Legacy v1 achievements remain readable; newly issued achievements use v2 and the
honest `wallet-signed-memo` verification label. A value from `localStorage` is
never treated as verified until this RPC check succeeds.

## Commercial path

PLOT TWIST is a B2B2C white-label module for broadcasters, clubs, tournament apps,
and fan platforms. A partner licenses it per tournament or active fan and sells
sponsored story rounds, loyalty rewards, and aggregate engagement analytics. The
fan loop remains free; revenue comes from distribution and engagement rather than
outcomes.

## Run locally

Requirements: Node.js 20+ and a Solana Wallet Standard browser wallet on devnet.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configure the server-only
TxLINE and Ollama values in `.env.local`; never prefix either secret with
`NEXT_PUBLIC_`.

If the browser wallet needs devnet SOL, fund its displayed address from a funded
CLI wallet:

```bash
solana transfer <BROWSER_WALLET_ADDRESS> 0.02 --allow-unfunded-recipient --url devnet
```

## Quality checks and deployment

```bash
npm test
npm run typecheck
npm run build
npm run start
```

The test suite covers match phase/catalog normalization, stale fixture-state
correction from live score actions, home/away score and player mapping,
fixture/team/deadline-aware resolution, compact v2 Memo generation, v1
compatibility, and rejection of forged XP or cross-fixture events.

For deployment, set `TXLINE_API_ORIGIN`, `TXLINE_API_TOKEN`, `OLLAMA_BASE_URL`,
`OLLAMA_API_KEY`, and `OLLAMA_MODEL`. `SOLANA_RPC_URL` is optional and defaults to
Solana's public devnet endpoint. Then open `/api/demo-readiness`; all three checks
must report `ready` before recording the demo.

## Submission links

- Live app: to be added after deployment
- Public repository: https://github.com/ILYUTKICK/plot-twist
- Demo video: https://ilyutkick.github.io/plot-twist/
- [60-second recording script](docs/DEMO_SCRIPT.md)
- [Competitive interface review](docs/COMPETITIVE_INTERFACE_REVIEW.md)
- [Ready-to-paste submission copy](docs/SUBMISSION.md)
