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
* All 319 SRD 5.1 spells, cantrips through 9th level (`src/config/spells.js`), with class lists per spell level for every caster, including the Fiend's expanded list and new Paladin and Ranger lists. Generated from the SRD 5.1 data (5e-bits/5e-database, CC BY 4.0).
* Spellcasting grows with level (`src/engine/spellProgress.js`, tables in `src/config/spellProgression.js`): SRD slot tables for full casters, half casters (Paladin and Ranger gain spells at level 2) and Warlock pact magic, plus Mystic Arcanum (6th–9th level, once per long rest). Life Domain spells are added as the cleric levels.
* "Learn new spells" in the Character tab after levelling up: new cantrips, spells known, wizard spellbook pages and Mystic Arcanum, validated by the engine (`applySpellChoices`).
* Upcasting: cast any leveled spell with a higher free slot for extra dice (`upcast` per spell, `upcastDice`). Storyteller-requested spell attacks carry the slot as `spell_attack:<id>:<slot>`.
* Area save spells (Fireball, Cone of Cold, …) roll damage once and an open save for each engaged enemy (`resolveAreaSaveSpell`).
* `successChance(totalModifier, dc, advantage)` in the dice engine: exact d20 odds including natural 1/20 and advantage/disadvantage.
* Mobile turn recovery: while a turn generates, the screen stays awake (Screen Wake Lock where supported). If the phone backgrounds the app and the request drops, the turn pauses quietly (`paused_background`) instead of erroring, and resumes automatically when you return or come back online. Genuinely failed, retryable turns get up to 2 automatic retries (`src/engine/turnRecovery.js`, `initTurnRecovery()`).
* `/api/dm-turn` accepts the client's `turnId` and reuses a generation already finished or in progress for the same player and turn for 5 minutes (`api/_lib/turnCache.js`), so a resumed turn usually costs no second generation. It is per-instance and best-effort.
* Universal tooltips (`<Tooltip>` in `src/components/common/ui.jsx`): hover or focus on desktop; on touch screens a separate ⓘ button next to the control opens a dismissible popover without triggering the control. Content lives in `src/config/helpTooltips.js` (abilities, skills, saves, AC, speed, HP, hit die, proficiency, weapon properties, conditions, World Forge settings, stances).
* Tooltips in the character creator (ability and skill picks, ability scores, weapon properties), World Forge settings, leveling pace controls, Engine tab, action stances, Character tab (abilities, skills with their modifier breakdown, saving throws), vitals HUD (AC, speed, HP, conditions) and inventory property tags.
* Global Almanac on every screen (floating button, `Alt+A`, or `?` when not typing): a non-blocking, draggable window on desktop and a bottom sheet that minimizes to a pill on phones. Tabs: Rules (incl. conditions and XP pacing), Origins & Roles, Gear & Arsenal (prices in the genre's currency), Powers (all 319 spells, levels 0–9) and, during a campaign, the World Codex (people, places, factions, rumors, Lore Pinboard). One search box covers everything; a genre selector shows reskinned names with the SRD name alongside.
* Pop-out Almanac (`/?almanac=1`): opens in its own browser window without signing in and follows the main window's genre and campaign over `BroadcastChannel('solo-rpg-almanac')`.
* `src/engine/almanac.js` (`buildAlmanacIndex`, `searchAlmanac`) and `src/config/rulesReference.js`.
* TV Series / Movie genre (`tv_movie`): type a show, film or book universe (Jericho, The Walking Dead, Firefly, …) and press "Tailor to Universe" in the character creator or World Forge. The storyteller renames species, classes, backgrounds, skills, languages and spell terms for that universe and suggests a world prompt; the rules underneath stay D&D 5e.
* `/api/world-forge` mode `mediaSkin` with `MEDIA_SKIN_SCHEMA`, `MEDIA_SKIN_RULES` and a mock. Generated skins are sanitized on the server and again on the client (`src/engine/mediaSkin.js`): names and flavor only, unknown keys and numbers dropped.
* Characters store their `mediaSkin`; campaigns store it in `meta.mediaSkin` and take the universe's theme (`meta.themeOverride`), currency and skill names. Reskin helpers (`speciesName`, `className`, `backgroundName`, `genreTerms`, `languageName`, `availableLanguages`) accept an optional media skin.
* Multi-format importers (`src/engine/importers.js`, `parseImportFile`): characters from D&D Beyond JSON, Roll20 5e OGL JSON, generic flat JSON (e.g. from a chatbot) and Markdown / plain-text sheets, alongside the native and Foundry VTT formats (Plutonium exports are Foundry actors). Class, species, skill and item names are matched to SRD ids (genre reskins included).
* Campaign documents (Foundry VTT journal / adventure exports, Markdown or Obsidian notes with Region, Factions, Locations, Quests and NPCs sections) open the World Forge pre-filled with a world prompt and Lore Pinboard entries.
* Import panel accepts `.json`, `.md` and `.txt` files or pasted text and shows the detected source. Unrecognized files offer "Smart Convert with AI" (`/api/world-forge` mode `convertImport`, `CONVERT_IMPORT_SCHEMA`); converted characters are shown for review before saving.

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
* Slot maximums are derived from class and level, so characters levelled before this release get their full slots on the next turn. The Spells panel shows slots for every level, groups prepared spells by level and offers a slot-level choice when casting.
* Prepared casters choose from their whole class list up to their highest slot level (wizards from their spellbook). The storyteller context includes slots left per level, in the uncached part of the prompt.
* `.gitignore`: `docs/*.pdf` (local reference books are never published).

### Fixed
* Characters never gained spell slots, spells or cantrips on level-up (a level-5 wizard kept two 1st-level slots).
* Guided choices on mobile: tapping a skill, stance or DC pill no longer sends the turn. Pills are separate buttons that open a breakdown (skill + ability, modifier parts, estimated DC and success chance); the action is its own button with an arrow.
* Test files under `api/` were deployed as broken serverless routes (e.g. `/api/dm-turn.test` returned 500). `.vercelignore` now excludes `api/**/*.test.js`.

### Security
* Forced `@grpc/grpc-js` to `^1.14.6` under `@firebase/firestore` via npm `overrides`, clearing GHSA-m9gg-hp2v-232j and GHSA-f596-whhp-79r4 (server-side advisories; the browser build never bundled grpc). `npm audit --omit=dev` now reports 0 vulnerabilities; remaining findings are dev-only Tailwind v3 tooling.
* Imported characters (any format, including AI conversion) keep only their six ability scores, level, names, skills and items; HP, AC, hit die, proficiency and XP are recomputed by the engine (`characterFromParts`), and scores are clamped to 1–30, level to 1–20.

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
