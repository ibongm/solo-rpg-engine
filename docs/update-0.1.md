\# Solo RPG Engine — Feature \& UX Upgrade Plan (8-Part Spec)



You are working on \*\*Solo RPG Engine\*\*. Follow all rules in `AGENTS.md` and `CLAUDE.md`:

\- Plain JS/JSX (no TypeScript), Tailwind CSS 3.4 theme tokens (`bg-surface`, `text-ink`, `border-line`, `text-accent` — never hex colors).

\- Deterministic engine in `src/engine/` (pure functions, seeded RNG, zero `Math.random`, zero React imports).

\- Every engine change MUST include unit tests in `src/engine/\*.test.js` (or `api/\*.test.js`).

\- Run `npm test \&\& npm run build` after each phase and update `CHANGELOG.md` under `\[Unreleased]`.



\---



\## Architecture Overview



```

Phase 1: Engine \& Genre Config  ──► #2 Genre Languages, #8 XP Pace, #1a Grounded Post-Apoc

Phase 2: Mobile UX \& Resilience ──► #5 ActionDeck Skill Pills, #7 Background Turn Recovery

Phase 3: UI Reference Systems   ──► #3 Universal Tooltips, #6 Global Almanac (Floating + Pop-out)

Phase 4: AI Skin \& Importers    ──► #1b TV/Movie Skin Generator, #4 Multi-Format Importers

```



\---



\## Phase 1: Genre Languages, Grounded Post-Apocalyptic \& XP Pacing (#2, #1a, #8)



\### Task 1.1 — Genre-Aware Languages (#2)

\*\*Problem:\*\* `src/components/hub/CharacterCreator.jsx` pulls `LANGUAGES` directly from `src/config/srd.js` (`Common, Dwarvish, Elvish, Abyssal...`), offering fantasy languages in Post-Apocalyptic, Frontier Noir, and Sci-Fi campaigns.



\*\*Instructions:\*\*

1\. In `src/config/srdReskins.js`:

&#x20;  - Add a `languages` map and `defaultLanguages` to each genre in `RESKINS`:

&#x20;    - `post\_apoc`: Map SRD languages to grounded survival tongues/codes:

&#x20;      - `Common` → `'English (Local)'`

&#x20;      - Extra languages list: `'Spanish'`, `'French'`, `'Mandarin'`, `'Russian'`, `'Arabic'`, `'German'`, `'ASL / Hand Signals'`, `'Military Radio Code'`, `'Morse \& Ham Code'`, `'Scavenger Cant / Trail Sign'`, `'Medical / Technical Jargon'`, `'Old-World Latin'`

&#x20;    - `frontier\_noir`:

&#x20;      - `Common` → `'English'`

&#x20;      - Extra languages list: `'Spanish'`, `'French'`, `'German'`, `'Cantonese'`, `'Plains Sign Talk'`, `'Lakota'`, `'Navajo'`, `'Telegraph Morse'`, `'Outlaw Cant'`, `'Latin'`, `'Gaelic'`, `'Yiddish'`

&#x20;    - `scifi`:

&#x20;      - `Common` → `'Galactic Standard'`

&#x20;      - Extra languages list: `'Binary / Machine Code'`, `'Spacer Pidgin'`, `'High Synod'`, `'Outer-Rim Creole'`, `'Sylphid High-Speech'`, `'Heavy-Worlder Cant'`, `'Draconid Battle-Sign'`, `'Encrypted Fleet Code'`, `'Xenolinguistics'`, `'Old Earth English'`, `'Corporate Legal-Speak'`, `'Void-Touched Whisper'`

&#x20;  - Export helper functions:

&#x20;    - `languageName(lang, genre, customSkin)` — translates an SRD language name (e.g., `'Dwarvish'` or `'Common'`) to its genre equivalent.

&#x20;    - `availableLanguages(genre, customSkin)` — returns the genre-appropriate array of extra languages for selection.

2\. In `src/components/hub/CharacterCreator.jsx` and `src/engine/characterBuilder.js`:

&#x20;  - Replace raw `LANGUAGES` and `sp.languages` display/selection with `availableLanguages(genre)` and `sp.languages.map((l) => languageName(l, genre))`.

3\. Add unit tests in `src/engine/characterBuilder.test.js` verifying that Post-Apocalyptic, Sci-Fi, and Frontier Noir characters receive genre-appropriate languages instead of Elvish/Dwarvish.



\---



\### Task 1.2 — Grounded Post-Apocalyptic Genre Options (#1a)

\*\*Problem:\*\* `RESKINS.post\_apoc` in `src/config/srdReskins.js` forces mutant/sci-fi tropes (`Scaled Mutant`, `Rad-Touched`, `Junk Gnome`, `Mutations`) that clash with grounded survival settings like \*The Walking Dead\*, \*Jericho\*, or \*The Last of Us\*.



\*\*Instructions:\*\*

1\. In `src/config/genreSkins.js` and `src/config/srdReskins.js`:

&#x20;  - Update `post\_apoc` to be \*\*Grounded Post-Apocalyptic Survival\*\* (think \*The Walking Dead\*, \*Jericho\*, \*The Last of Us\*):

&#x20;    - `terms`: `{ species: 'Upbringing', class: 'Role', background: 'Before the Fall', spells: 'Tactics \& Grit', cantrips: 'Field Tricks', spell: 'tactic' }`

&#x20;    - `currencyLabel`: `'Barter / Ammo'`

&#x20;    - `species` (Upbringings — same 5e ability bonuses and traits, grounded flavor):

&#x20;      - `human` → `'Town Survivor'` ("Everyday citizens who adapted fast when the grid went down.")

&#x20;      - `dwarf` → `'Homesteader / Prepper'` ("Stocky, resilient rural folk raised on well water, canned stores, and hard labor.")

&#x20;      - `elf` → `'Backcountry Hunter'` ("Sharp-eyed woodsfolk who move quietly and keep watch while resting.")

&#x20;      - `halfling` → `'Urban Scavenger'` ("Nimble, cool-headed survivors who slip past hordes and patrols unseen.")

&#x20;      - `dragonborn` → `'Breacher / Pyro Tech'` ("Broad-shouldered heavy-gear specialists carrying improvised incendiary/chemical charges.")

&#x20;      - `gnome` → `'Ham-Radio Tinker'` ("Clever electronics and mechanical specialists who keep generators and radios alive.")

&#x20;      - `half\_elf` → `'Drifter / Courier'` ("Road-tested intermediaries who bridge isolated settlements.")

&#x20;      - `half\_orc` → `'Enforcer / Brawler'` ("Scarred, relentless fighters who refuse to stay down when hit.")

&#x20;      - `tiefling` → `'Night-Watch Outcast'` ("Hardened survivors accustomed to darkness, fire, and distrust.")

&#x20;    - `classes` (Roles):

&#x20;      - `barbarian`: `'Brawler'`, `bard`: `'Community Leader'`, `cleric`: `'Field Medic'`, `druid`: `'Forager'`, `fighter`: `'Marksman / Veteran'`, `monk`: `'Close-Quarters Survivor'`, `paladin`: `'Sheriff / Protector'`, `ranger`: `'Scout'`, `rogue`: `'Scavenger'`, `sorcerer`: `'Instinctual Tactician'`, `warlock`: `'Faction Operative'`, `wizard`: `'Engineer / Strategist'`

&#x20;    - `backgrounds` (Before the Fall):

&#x20;      - `acolyte`: `'First Responder'`, `veteran`: `'National Guard / Police'`, `urchin`: `'Runaway'`, `scholar`: `'Town Teacher / Doctor'`, `wanderer`: `'Long-Haul Trucker'`, `swindler`: `'Black-Market Broker'`, `folk\_hero`: `'Small-Town Mayor / Farmer'`, `noble`: `'Politician / Executive'`, `performer`: `'Radio Host'`, `healer`: `'ER Nurse / Paramedic'`

&#x20;  - (Optional) Keep the old mutant/wasteland flavor as a separate genre entry `wasteland` ("Mutant Wasteland") in `GENRES` and `RESKINS` so both \*Walking Dead\* and \*Fallout\* styles are supported.



\---



\### Task 1.3 — Level Progression Speed (`xpPace`) (#8)

\*\*Problem:\*\* `src/engine/deeds.js` awards high base XP and uses `levelScale(level) = gap / 300` to auto-inflate XP at higher levels, causing players to level up every \~3–5 turns at all tiers.



\*\*Instructions:\*\*

1\. In `src/engine/deeds.js`:

&#x20;  - Define `XP\_PACES = \['story', 'standard', 'slow', 'gritty']` and `XP\_PACE\_INFO`:

&#x20;    - `story`: `{ label: 'Fast / Story (1.5×)', multiplier: 1.5, scalePower: 1.0, cooldownMult: 0.75, blurb: 'Quick progression (\~3–5 turns per level). Ideal for short stories.' }`

&#x20;    - `standard`: `{ label: 'Standard RPG (0.6×)', multiplier: 0.6, scalePower: 0.5, cooldownMult: 1.5, blurb: 'Balanced campaign pace (\~10–15 turns at early levels, longer as you grow).' }`

&#x20;    - `slow`: `{ label: 'Slow / Tabletop (0.3×)', multiplier: 0.3, scalePower: 0.25, cooldownMult: 2.5, blurb: 'True D\&D tabletop pace (\~25–40+ turns per level). Every level is earned.' }`

&#x20;    - `gritty`: `{ label: 'Gritty Survival (0.15×)', multiplier: 0.15, scalePower: 0.0, cooldownMult: 4.0, blurb: 'Hardcore long-haul survival. Raw 5e XP thresholds with zero level inflation.' }`

&#x20;  - Make `'standard'` the default `xpPace(campaign)` (reading `campaign?.meta?.xpPace`).

&#x20;  - Update `levelScale(level, pace = 'standard')`:

&#x20;    - Compute `rawRatio = Math.max(1, gap / 300)` and apply `Math.pow(rawRatio, XP\_PACE\_INFO\[pace].scalePower)`.

&#x20;  - Update `scoreDeeds(deeds, level, pace = 'standard')`:

&#x20;    - Multiply `base \* levelScale(level, pace) \* XP\_PACE\_INFO\[pace].multiplier` (minimum `1` XP if `base > 0`).

&#x20;  - Update `milestoneCooldown(level, pace = 'standard')`:

&#x20;    - Multiply base cooldown (`6` or `10`) by `XP\_PACE\_INFO\[pace].cooldownMult`.

2\. Wire `xpPace` into:

&#x20;  - `src/engine/stateMutator.js` where `scoreDeeds` and `resolveMilestone` are called.

&#x20;  - `src/engine/campaignFactory.js` (`meta.xpPace = xpPace || 'standard'`).

&#x20;  - `src/components/hub/WorldForgeWizard.jsx` (Step 1: "Leveling Pace" selector right below Experience mode).

&#x20;  - `src/components/sidebar/Tab6Engine.jsx` (Progression section: allow changing `meta.xpPace` mid-campaign).

3\. Add comprehensive tests in `src/engine/deeds.test.js` covering all 4 `xpPace` modes for both `scoreDeeds` and `resolveMilestone`.



\---



\## Phase 2: Mobile ActionDeck Fix \& Background Turn Resilience (#5, #7)



\### Task 2.1 — Separate Skill/DC Inspection from Choice Submission in `ActionDeck.jsx` (#5)

\*\*Problem:\*\* In `src/components/stage/ActionDeck.jsx`, each guided choice card is a single `<button onClick={() => choose(c)}>` containing `.pill` spans for `stance`, `default\_skill`, and `estimated\_dc`. On mobile, tapping the skill pill (`Investigation`) to see what it means or what your modifier is immediately fires `choose(c)` and submits the turn.



\*\*Instructions:\*\*

1\. In `src/components/stage/ActionDeck.jsx`:

&#x20;  - Refactor each guided choice card (`campaign.lastChoices.slice(0, 3)`) from a monolithic `<button>` into a structured card container `<div className="group ...">`:

&#x20;    - \*\*Top/Main Action Area:\*\* A `<button onClick={() => choose(c)}>` containing the stance icon, the choice text `c.label`, and a clear action affordance (`Send` / `ChevronRight` icon).

&#x20;    - \*\*Bottom Metadata Bar:\*\* Separate `<button type="button">` pills for `c.stance`, `c.default\_skill`, and `c.estimated\_dc` that call `e.stopPropagation()` and toggle an inline/popover breakdown for that pill!

&#x20;  - When the player taps or hovers the skill pill (e.g., `Investigation`), compute `buildCheck({ character, skillOrStat: c.default\_skill, dc: c.estimated\_dc, weather: campaign.worldState?.weather, skin })` from `src/engine/diceEngine.js` and display a compact tooltip/popover showing:

&#x20;    - Skill name \& governing ability (e.g., `Investigation (INT)`)

&#x20;    - Total modifier \& breakdown (e.g., `+4 = INT +2, Proficiency +2`)

&#x20;    - Estimated DC \& rough success chance if `c.estimated\_dc` is present

&#x20;    - Explicit "Tap the action text above to perform this action" hint on mobile.



\---



\### Task 2.2 — Background Turn Continuation \& Mobile App-Switch Recovery (#7)

\*\*Problem:\*\* When a player submits a turn on mobile and switches to another app, mobile browsers suspend the page and abort the in-flight `fetch('/api/dm-turn')`, throwing `'Network error — check your connection.'` and halting the turn until the user manually clicks Retry.



\*\*Instructions:\*\*

1\. \*\*Screen Wake Lock during active turns (`src/store/turnRunner.js`):\*\*

&#x20;  - Acquire `navigator.wakeLock?.request('screen')` (wrapped in try/catch for unsupported browsers) when `runQueue()` starts, and release it in `finally` so the phone screen doesn't auto-lock mid-generation.

2\. \*\*Graceful Background Interruption \& Auto-Resume (`src/store/turnRunner.js` \& `src/firebase/api.js`):\*\*

&#x20;  - Track whether the page became hidden (`document.visibilityState === 'hidden'`) during an in-flight `callApi('dm-turn', ...)`.

&#x20;  - If `callApi` throws a `network` error while `document.visibilityState === 'hidden'` (or within 2 seconds of returning from `hidden`):

&#x20;    - Do \*\*not\*\* show a scary red error toast. Instead, set `retryQueue` status to `'paused\_background'` and show an info toast `'Resuming turn in background…'` when visibility returns.

&#x20;  - Register a global `document.addEventListener('visibilitychange', ...)` listener (and `window.addEventListener('online', ...)`) in `turnRunner.js`:

&#x20;    - When `document.visibilityState === 'visible'` and `retryQueue` is in `'paused\_background'` or `'failed'` (with `retryable: true` and < 2 auto-retries), automatically invoke `runQueue()` without requiring manual user intervention!

3\. \*\*Server-Side Turn Deduplication Cache (`api/dm-turn.js`):\*\*

&#x20;  - Accept optional `turnId` in `POST /api/dm-turn` body (passed from `q.turnId` in `turnRunner.js`).

&#x20;  - Keep a short-lived in-memory `Map` cache (`TURN\_RESULT\_CACHE`, TTL 5 minutes, keyed by `${uid}:${turnId}`) in `api/dm-turn.js`:

&#x20;    - If the mobile browser disconnected while Vertex AI was still generating, the Vercel function finishes generating and stores `{ result, usage, model, cacheRef }` in `TURN\_RESULT\_CACHE` (and if an in-flight promise for `${uid}:${turnId}` is still running when the client reconnects, `await` the existing promise!).

&#x20;    - When the client auto-resumes on app focus and re-sends the same `turnId`, `/api/dm-turn` immediately returns the completed (or in-flight) result with zero extra latency and zero double token charge.

4\. Add unit tests in `api/dm-turn.test.js` testing `turnId` deduplication.



\---



\## Phase 3: Universal Tooltips \& Global Non-Blocking Almanac (#3, #6)



\### Task 3.1 — Universal Desktop \& Mobile `<Tooltip>` System (#3)

\*\*Problem:\*\* Character creation, world building, and in-game controls lack consistent tooltips, and HTML `title` attributes do not work on mobile touch devices.



\*\*Instructions:\*\*

1\. Create a reusable `<Tooltip title={...} details={...} badge={...}>` component in `src/components/common/ui.jsx`:

&#x20;  - \*\*Desktop:\*\* Instant floating popover on `onMouseEnter` / `onFocus` (positioned safely within viewport bounds).

&#x20;  - \*\*Mobile / Touch:\*\* Renders a subtle tappable `?` / `Info` affordance (or triggers on long-press `onTouchStart` 400ms) that opens a dismissible mini-popover without triggering the parent button's `onClick`.

2\. Create `src/config/helpTooltips.js` containing concise mechanical + flavor descriptions for:

&#x20;  - All 6 abilities (`str`, `dex`, `con`, `int`, `wis`, `cha`)

&#x20;  - All 18 skills (`acrobatics`..`survival`) + saving throws + AC + Speed + Hit Die + Proficiency Bonus

&#x20;  - Weapon properties (`finesse`, `light`, `heavy`, `versatile`, `reach`, `thrown`, `loading`, `ammunition`, `two-handed`)

&#x20;  - Conditions (`Blinded`, `Charmed`, `Frightened`, `Grappled`, `Incapacitated`, `Invisible`, `Paralyzed`, `Poisoned`, `Prone`, `Restrained`, `Stunned`, `Unconscious`)

&#x20;  - World Forge settings (`Tone`, `Strictness`, `Quests`, `XP Mode`, `XP Pace`, `Action Mode`, `Dice Mode`, `Scene Images`)

&#x20;  - Stances (`Diplomatic`, `Aggressive`, `Deceptive`, `Investigative`, `Tactical`)

3\. Integrate `<Tooltip>` across:

&#x20;  - `src/components/hub/CharacterCreator.jsx` (Abilities, Species traits, Class features, Fighting styles, Skills, Equipment properties, Spells, Perks).

&#x20;  - `src/components/hub/WorldForgeWizard.jsx` (Sliders, Progression modes, Action/Dice/Image modes, Faction reputation/heat).

&#x20;  - `src/components/stage/\*` and `src/components/sidebar/\*` (Vitals HUD, Stance pills, Tactical actions, Conditions, Inventory items, Skills in Tab1Character).



\---



\### Task 3.2 — Global Almanac Window (Available Everywhere + Pop-Out Support) (#6)

\*\*Problem:\*\* There is no global reference Almanac accessible from Character Creation, World Forge, the Hub, or mid-game without interrupting the current workflow.



\*\*Instructions:\*\*

1\. Create `src/components/common/AlmanacWindow.jsx`:

&#x20;  - Accessible from \*\*every screen\*\* via a persistent header/floating button (`BookOpen` icon, labeled `Almanac`, hotkey `Alt+A` or `?` when no input is focused) mounted in `src/App.jsx` above `Modal` z-index (`z-\[55]`).

&#x20;  - \*\*Non-blocking floating window mode:\*\*

&#x20;    - On desktop: A draggable/resizable or dockable floating panel (`w-\[420px] sm:w-\[540px] max-h-\[80dvh]`) that stays open while the user clicks around in `CharacterCreator`, `WorldForgeWizard`, or `GameStage` (no backdrop blocking pointer events!).

&#x20;    - On mobile: A slide-over sheet that can be minimized to a floating pill and restored at the exact same scroll/search position.

&#x20;  - \*\*Pop-Out to Separate Browser Window mode:\*\*

&#x20;    - Include a \*\*"Pop Out Window" (`ExternalLink` icon)\*\* button in the Almanac header.

&#x20;    - Clicking it opens `window.open('/?almanac=1', 'SoloRpgAlmanac', 'width=600,height=780')`.

&#x20;    - In `src/App.jsx`, if `new URLSearchParams(window.location.search).get('almanac') === '1'`, render `<AlmanacStandalone />` full-window, synced with active campaign/genre state via `localStorage` / `BroadcastChannel('solo-rpg-almanac')`.

&#x20;  - \*\*Almanac Tabs \& Search:\*\*

&#x20;    - Instant search bar filtering across all categories + Genre Skin selector (defaults to active campaign or creator genre).

&#x20;    - \*\*Tab 1: Rules \& Mechanics\*\* (Ability checks, Advantage/Disadvantage, Combat actions, Death saves, Resting, Conditions, XP Pacing).

&#x20;    - \*\*Tab 2: Origins \& Roles\*\* (All Species/Upbringings, Classes/Roles, and Backgrounds with their reskinned names + 5e traits).

&#x20;    - \*\*Tab 3: Gear \& Arsenal\*\* (All Weapons, Armor, and Gear with damage dice, AC math, properties, and prices in the selected genre).

&#x20;    - \*\*Tab 4: Powers \& Spells\*\* (All Cantrips and Level 1–5 spells/tactics/mutations).

&#x20;    - \*\*Tab 5: World Codex\*\* (When a campaign is active: live searchable NPCs, Locations, Factions, Rumors, and Lore Pinboard).



\---



\## Phase 4: TV/Movie Setting Generator \& Universal Importers (#1b, #4)



\### Task 4.1 — "TV Series / Movie" Genre \& AI Skin Generator (#1b)

\*\*Problem:\*\* Players want to select a \*\*TV Series / Movie\*\* genre, search/enter a show or film (e.g., \*Jericho\*, \*The Walking Dead\*, \*Firefly\*, \*The Expanse\*, \*Deadwood\*, \*Stranger Things\*), and get character creation \& world-building choices tailored to that universe.



\*\*Instructions:\*\*

1\. In `src/config/genreSkins.js`:

&#x20;  - Add `tv\_movie` to `GENRES`:

&#x20;    - `id: 'tv\_movie'`, `label: 'TV Series / Movie'`, `theme: 'frontier\_noir'` (or dynamic based on generated skin), `currencyLabel: 'Resources'`, `blurb: 'Type any TV series, film, or book universe to tailor origins, roles, gear, and world building.'`

2\. In `api/\_lib/schemas.js`, `api/\_lib/prompts.js`, `api/\_lib/mock.js`, and `api/world-forge.js`:

&#x20;  - Add `mode: 'mediaSkin'` to `/api/world-forge`:

&#x20;    - Input: `{ mode: 'mediaSkin', mediaTitle: 'Jericho (TV Series)', mediaNotes: 'Small Kansas town after nuclear attacks...' }`

&#x20;    - Output schema `MEDIA\_SKIN\_SCHEMA`:

&#x20;      - `title`: canonical show/movie title

&#x20;      - `theme`: `'fantasy' | 'frontier\_noir' | 'scifi'`

&#x20;      - `currencyLabel`: string

&#x20;      - `rationLabel`: string

&#x20;      - `terms`: `{ species, class, background, spells, cantrips, spell }`

&#x20;      - `skillLabels`: map of the 18 canonical `SKILL\_KEYS` to setting-appropriate names

&#x20;      - `species`: map of the 9 SRD species IDs (`dwarf`, `elf`, `halfling`, `human`, `dragonborn`, `gnome`, `half\_elf`, `half\_orc`, `tiefling`) to `{ name, blurb }` grounded in that show/movie

&#x20;      - `classes`: map of the 12 SRD class IDs to setting-specific roles/archetypes

&#x20;      - `backgrounds`: map of the 10 SRD background IDs to setting-specific pasts

&#x20;      - `languages`: array of 10 setting-appropriate languages/codes

&#x20;      - `worldPromptSuggestion`: a ready-to-use 2-paragraph world prompt for `WorldForgeWizard`

3\. In `src/components/hub/CharacterCreator.jsx` and `src/components/hub/WorldForgeWizard.jsx`:

&#x20;  - When `genre === 'tv\_movie'`, display a \*\*"TV Series / Movie Universe"\*\* search input + \*\*"Tailor to Universe"\*\* button.

&#x20;  - Store the generated `mediaSkin` on the character (`character.mediaSkin`) and campaign (`campaign.skin`), and pass it into `speciesName`, `className`, `backgroundName`, and `availableLanguages`.



\---



\### Task 4.2 — Multi-Format Character \& Campaign Importers (#4)

\*\*Problem:\*\* `parseImportJson` in `src/engine/exporters.js` only supports native JSON and Foundry VTT `dnd5e` actors. Players want to import characters and campaigns from the most common RPG formats.



\*\*Instructions:\*\*

1\. Expand `src/engine/exporters.js` (`parseImportJson` and new helper `parseImportFile(text, filename, options)`):

&#x20;  - Auto-detect and convert the following \*\*Character formats\*\*:

&#x20;    1. \*\*Native Solo RPG Engine bundle\*\* (`format === 'solo-rpg-engine/character'`)

&#x20;    2. \*\*Foundry VTT `dnd5e` Actor JSON\*\* (`system.abilities`)

&#x20;    3. \*\*D\&D Beyond Character JSON\*\* (`data?.stats` or `stats` array with `id: 1..6`, `race.fullName`, `classes\[].definition.name`, `inventory\[].definition`)

&#x20;    4. \*\*Roll20 Character Vault / 5e OGL JSON\*\* (`schema\_version` + `character.attribs` array with `strength`, `dexterity`, `class`, `hp`, `ac`, repeating inventory rows)

&#x20;    5. \*\*5e.tools / Plutonium Character JSON\*\*

&#x20;    6. \*\*Generic Flat JSON / ChatGPT JSON character\*\* (any JSON object containing `name` and ability scores `str/strength`, `dex/dexterity`, etc.)

&#x20;    7. \*\*Markdown / Plain-Text Character Sheet\*\* (`.md` / `.txt` files: parse `Name`, `Level`, `Class`, `HP`, `AC`, `STR/DEX/CON/INT/WIS/CHA`, skills, and bulleted inventory).

&#x20;  - Auto-detect and convert the following \*\*Campaign formats\*\*:

&#x20;    1. \*\*Native Solo RPG Engine campaign bundle\*\* (`format === 'solo-rpg-engine/campaign'`)

&#x20;    2. \*\*Foundry VTT Adventure / Journal Export JSON\*\* (`journal` / `folders` / `actors` → converts into a pre-filled Campaign Seed / Lore Pinboard + Codex entries).

&#x20;    3. \*\*Markdown Campaign / Obsidian Vault Document (`.md`)\*\* (extracts `# Title`, `## Region`, `## Factions`, `## Locations`, `## Quests`, `## NPCs` into a complete playable campaign bundle or World Forge seed).

2\. Add an \*\*AI Format Converter Fallback\*\* (`mode: 'convertImport'` in `/api/world-forge`):

&#x20;  - In `src/components/hub/ImportExportModal.jsx`, allow uploading `.json`, `.md`, `.txt` or pasting raw text.

&#x20;  - If deterministic parsing succeeds, import immediately and show a badge of the detected source (`D\&D Beyond`, `Roll20`, `Foundry VTT`, `Markdown Sheet`, etc.).

&#x20;  - If the file is an arbitrary unstructured character sheet or campaign module, offer a \*\*"Smart Convert with AI"\*\* button that extracts a structured character or campaign seed and runs it through `sanitizeImportedCharacter()`.

3\. Add unit tests in `src/engine/exporters.test.js` covering D\&D Beyond JSON, Roll20 JSON, Generic JSON, and Markdown character/campaign imports.



\---



\## Verification Checklist (Run Before Completing)



\- \[ ] `npm test` — all existing and new Vitest unit tests pass (`characterBuilder.test.js`, `deeds.test.js`, `exporters.test.js`, `dm-turn.test.js`).

\- \[ ] `npm run build` — Vite production bundle succeeds with zero errors.

\- \[ ] `CHANGELOG.md` updated under `\[Unreleased]` with `Added`, `Changed`, and `Fixed` entries.



