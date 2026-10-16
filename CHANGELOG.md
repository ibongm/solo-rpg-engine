# Changelog

All notable changes to the Solo RPG Engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
* `AGENTS.md`: Canonical engineering guidelines, non-negotiable coding standards, separation of concerns, and prohibited mechanics directives for all AI agents and contributors.
* `README.md`: Central repository overview detailing system architecture, quickstart instructions, documentation links, and available npm scripts.
* `.github/workflows/ci.yml`: GitHub Actions automated CI pipeline running tests (`npm run test`) and production build verification (`npm run build`) on Node.js 24 (Vitest 5 and firebase-admin 14 require Node 22+).
* `.github/pull_request_template.md`: Standardized template for pull requests with testing and verification checklists.
* `.github/ISSUE_TEMPLATE/bug_report.md`: Issue template for reporting bugs and unexpected gameplay engine behaviors.
* `.github/ISSUE_TEMPLATE/feature_request.md`: Issue template for suggesting engine enhancements or narrative mechanics.
* `docs/`: Dedicated documentation directory consolidating setup guides, legal notices, and architectural specifications.
* Genre languages: every SRD language now has a genre equivalent (e.g. Dwarvish → `Morse & Ham Code` in post-apocalyptic, `Heavy-Worlder Cant` in sci-fi, `Cornish Miner's Cant` in frontier noir), plus genre-only extra languages to pick. `languageName()` / `availableLanguages()` in `src/config/srdReskins.js`.
* `wasteland` genre ("Mutant Wasteland"): the previous mutant/Fallout-style post-apocalyptic reskin, kept as its own genre with its own languages, shop and starter kit.
* `docs/update-0.1.md`: the 8-part feature & UX upgrade spec being implemented.
* Leveling pace (`meta.xpPace`): Story, Standard, Slow and Gritty. Roughly 4 / 8 / 12 / 20 turns for level 2, with slower paces stretching later levels (Standard ≈ 25 turns at level 10, Gritty ≈ 100). Applies to Deeds XP and to milestone spacing.
* XP fine-tune (`meta.xpMultiplier`, 0.5×–2×) on top of the pace. Both are set in the World Forge and can be changed mid-campaign in the Engine tab, which shows the engine's turns-per-level estimate (`estimatedTurnsPerLevel`).

### Changed
* `CLAUDE.md`: Converted into a redirect pointer referencing `AGENTS.md`.
* Relocated `SETUP.md` to `docs/SETUP.md`.
* Relocated `NOTICE.md` to `docs/NOTICE.md`.
* Relocated `rpg-blueprint.md` to `docs/rpg-blueprint.md`.
* `package.json`: Declared `engines.node >=22.12.0`; README and `docs/SETUP.md` updated to match.
* Bundle splitting: `GuildhallHub`, `GameStage`, and the Map tab (`@xyflow/react`) are lazy-loaded, and React and Firebase are emitted as separate long-cached vendor chunks (`vite.config.js` `codeSplitting` groups). Initial JS dropped from ~1.5 MB to ~930 kB (minified).
* `post_apoc` is now grounded Post-Apocalyptic Survival (The Walking Dead, Jericho, The Last of Us): Upbringings, Roles and Before-the-Fall backgrounds, realistic gear names, `Barter / Ammo` currency, grounded skill labels, shop, starter kit and scene-art style. Existing post-apocalyptic characters show the new names.
* Characters store languages in their genre's words at creation (like tools); the sheet, print view and storyteller context also translate older characters on display.
* `AGENTS.md`: rewritten agent guide (commands, stack, project map, engine rules, code style, boundaries).
* `scoreDeeds`, `levelScale`, `milestoneCooldown` and `resolveMilestone` take the pace. Campaigns without a pace now use Standard, so existing Deeds campaigns level more slowly than before.
* The Character tab's XP table, the milestone countdown and the storyteller context use the campaign's pace.

### Security
* Forced `@grpc/grpc-js` to `^1.14.6` under `@firebase/firestore` via npm `overrides`, clearing GHSA-m9gg-hp2v-232j and GHSA-f596-whhp-79r4 (server-side advisories; the browser build never bundled grpc). `npm audit --omit=dev` now reports 0 vulnerabilities; remaining findings are dev-only Tailwind v3 tooling.

---

## [1.0.0] - 2026-10-16

### Added
* Deterministic Frontend Rules Lawyer (`src/engine/`):
  * Pure JavaScript dice math engine with transparent modifier calculations.
  * Clock, weather, and calendar progression tracking.
  * Turn-based tactical combat resolver and enemy mechanics.
  * Economy, inventory, spellcasting, minigames, and character progression.
  * State mutator enforcing immutable updates and anti-glitch single-turn correction.
* Generative Storyteller Backend (`api/`):
  * Serverless endpoints interacting with Google Cloud Vertex AI (Gemini & Imagen 3).
  * Strict JSON schema validation (`api/_lib/schemas.js`) for all AI turn responses.
  * Context caching and prompt compilation pipeline.
* Multi-Genre UI & Theming (`src/styles/themes.css`):
  * Dynamic theme switching between Fantasy, Frontier Noir, and Sci-Fi.
  * 60% Left/Center Game Stage and 40% Right Command Sidebar desktop split.
  * Keyboard navigation and hotkey accessibility.
  * Offline-first local action retry queue backed by `localStorage`.
* Full test coverage for deterministic engine modules via Vitest.
