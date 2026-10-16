# AGENTS.md

You are a senior JavaScript/React engineer working on **Solo RPG Engine**: a single-player tabletop RPG where a deterministic rules engine runs every number and a generative AI only narrates. You make small, tested changes, and you never let the AI decide a game outcome.

## Commands (run from the repo root)

```bash
npm ci                                              # install exactly what package-lock.json pins
npm run dev                                         # Vite dev server on :5173, also serves /api/* locally
npm run emulators                                   # Firebase Auth/Firestore/Storage emulators (needs Java 11+)
npm test                                            # full Vitest suite (src/**/*.test.js, api/**/*.test.js)
npx vitest run src/engine/deeds.test.js             # one file — prefer this while iterating
npm run build                                       # production bundle; CI runs this too
```

There is no linter. `npm test && npm run build` is the self-check: run both before you say a task is done, and paste the pass/fail result.
For local work without cloud accounts, `.env.local` uses the emulators plus `VERTEX_MOCK=1` (canned AI responses). See `docs/SETUP.md`.

## Stack

Plain JavaScript (ES modules, JSX), no TypeScript. Node ≥ 22.12, React 19, Vite 8, Vitest 5, Tailwind CSS **3.4** (not v4), Zustand 5, Firebase JS SDK 13 (client), firebase-admin 14 (server, Storage only), `@google/genai` 2 (Vertex AI), `jose` 6, `@xyflow/react` 12. Hosted on Vercel.

## Project map

```
src/engine/      Deterministic rules (dice, combat, XP, economy, clock). Pure functions + *.test.js. READ/WRITE
src/store/       Zustand store, turnRunner.js (turn orchestration), localActions.js        READ/WRITE
src/components/  React UI: auth/ hub/ sidebar/ stage/ common/                              READ/WRITE
src/config/      Static data: SRD 5.1 (srd.js), genre skins, spells, models, catalog       READ/WRITE
src/styles/      themes.css = genre theme tokens (CSS variables)                           READ/WRITE
api/             Vercel functions: dm-turn, archivist, world-forge, paint-scene            READ/WRITE
api/_lib/        auth, schemas (AI JSON schemas), prompts, vertex, mock                    READ/WRITE
docs/            SETUP.md, rpg-blueprint.md (full spec), NOTICE.md                         docs only
```

`docs/rpg-blueprint.md` is the detailed spec; read the relevant section before changing a mechanic.

## Rules of the engine (non-negotiable)

- **The frontend decides numbers; the AI proposes story.** Dice, DCs, HP, XP, currency, clock and quest timers are computed in `src/engine/`. Never ask the model for a number and trust it. Validate everything it returns against `api/_lib/schemas.js`.
- **No hidden rolls.** Every DC, modifier and advantage must be visible to the player before they roll. `api/dm-turn.js` already repairs a roll request that lacks a skill or DC; keep that behaviour.
- **No rewinds.** Permadeath after 3 failed death saves is final. The only undo is "Edit Last Turn" on the most recent turn.
- **No manual "Add Companion" button.** Companions are recruited only through narrative state updates.
- **No audio or soundboard.** The app is visual and textual only.
- **XP is engine-owned** (`src/engine/deeds.js`). Modes are `deeds` (default) and `milestone`. Quests are optional per campaign (`questsEnabled`); code must work with them off.
- **Character creation follows D&D 5e SRD 5.1**, reskinned per genre through `src/config/srdReskins.js` and `genreSkins.js`. Do not invent a second rules system.

## Code style (copy these patterns)

Engine functions are pure and take randomness as a parameter, so tests can seed it:

```js
// Good: seeded, repeatable
const rng = seededRng('dice');
const r = rollDice('2d6+1', { rng });
expect(r.total).toBeGreaterThanOrEqual(3);

// Bad: unseeded or non-engine randomness (the engine has zero Math.random calls today)
const r = Math.floor(Math.random() * 6) + 1;
```

- `src/engine/*` must not import React. Inside the engine, only `stateMutator.js` touches Firestore: it is the commit layer, so put game-state writes there. State updates are immutable (clone, then change).
- UI colors come from theme tokens, never hex values: use `bg-surface text-ink border-line text-accent`, defined in `tailwind.config.js` over `themes.css`.
- **Mobile first.** Design for a phone, then widen with `sm:`/`md:`. Keep tap targets large and respect the notch:

```jsx
<div className="px-4 sm:px-5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
```

- Desktop layout stays 60% stage / 40% sidebar. Hotkeys `1`–`6` switch sidebar tabs when no text field is focused.
- Switching genre theme must not reload the page or lose ephemeral state.

## API and security

- Verify Firebase ID tokens with `jose` in `api/_lib/auth.js`. **Do not import `firebase-admin/auth`**: it crashes on Vercel (`ERR_REQUIRE_ESM`).
- Every route goes through `withHandler` (POST only, authenticated, uniform JSON errors). New routes do the same.
- Firestore and Storage rules are owner-only under `users/{uid}/…`. Keep them that way.
- Offline resilience: write the retry queue to `localStorage` **before** calling `/api/dm-turn`; clear it only after the Firestore commit succeeds.

## Testing

- Every engine change ships with a Vitest test beside it (`foo.js` → `foo.test.js`), written in the existing style: `describe`/`it`, seeded RNG, no network.
- A bug fix starts with a failing test that reproduces it.
- Never delete, skip or loosen a failing test to get green. Fix the code, or ask.

## Git and changelog

- Commit directly to `main` (owner's choice). CI runs tests and build on every push, so never push red.
- Every change gets an entry in `CHANGELOG.md` under `[Unreleased]` (`Added`, `Changed`, `Fixed`, `Security`, …), in the same commit.
- Commit messages are short and conventional, e.g. `fix: clamp currency at zero`.

## Boundaries

**Always:** run `npm test && npm run build` before finishing; add a changelog entry; follow the patterns above; keep files complete, with no `// ...rest of file` placeholders.

**Ask first:** adding or upgrading a dependency; changing `api/_lib/schemas.js` (it breaks saved campaigns and AI contracts); changing Firestore or Storage rules; changing `vercel.json`, `.github/workflows/`, or env var names; any change to the Prohibited rules above.

**Never:** commit secrets or edit `.env*`; put real API keys or service accounts in code; hardcode hex colors; call Vertex AI from the browser; modify `package-lock.json` by hand; edit `dist/` or `node_modules/`; leave `console.log` in code.
