# Solo RPG Engine — Master Architecture & Implementation Blueprint

## 1. Project Overview
A personal, single-player tabletop RPG web application powered by deterministic D&D 5e math on the frontend and Google Cloud Vertex AI on the backend. Designed to support both classic High Fantasy and custom non-fantasy genres (Frontier/Western, Comic Noir, Sci-Fi, Post-Apocalyptic) with deep world simulation, a 3-tier memory system, permadeath stakes, and a persistent 6-tab Command Sidebar.

---

## 2. Core Tech Stack & Infrastructure
* **Frontend Framework:** React 19 + Vite + Tailwind CSS
* **State Management:** Zustand (with `localStorage` persistence for the Instant Local Rollback / Retry Queue)
* **Interactive Node Map:** `@xyflow/react` (React Flow)
* **Icons & UI Primitives:** `lucide-react`
* **Backend / Hosting:** Vercel + Vercel Serverless Functions (`/api/*`)
* **Database & Storage:** Firebase (Firebase Auth, Cloud Firestore, Firebase Cloud Storage)
* **AI Provider:** Google Cloud Vertex AI (using GCP Service Account credentials in Vercel environment variables)
  * **Selectable Text Models:**
    * `gemini-3.8-flash` (Default Daily Driver)
    * `gemini-3.6-flash` (Fast Fallback / Alternate Prose)
    * `gemini-4-argon` (Heavy Reasoning, World Seeding, Complex Plot/Mystery Resolution)
  * **Image Generation Model:** `imagen-3.0-generate-002` (3-Mode Toggle: `Off` | `Manual / On-Demand` | `Auto-Director`)
  * **Cost Optimization:** Vertex AI Context Caching enabled for static system rules, character sheets, and the Rulebook/Lore Pinboard.

---

## 3. Complete Feature Manifest

### A. The Guildhall Start Screen (Hub) & I/O Engine
1. **The Roster (Decoupled Character Vault):** Create, edit, clone, and store multiple characters independently of campaigns. Surviving veterans can be imported into sequel campaigns.
2. **The Campaign Shelf:** Displays active and completed campaigns with Genre Theme, Active Character, Current Location Node, Last Played timestamp, and Total API Cost accrued.
3. **World Forge Wizard (New Campaign Builder):**
   * **Genre Presets & Custom Skins:** High Fantasy, Gritty Frontier / Comic Noir, Post-Apocalyptic, Sci-Fi, or Custom.
   * **Skill & Currency Reskinning:** Keeps 5e core stats (`STR, DEX, CON, INT, WIS, CHA`) while dynamically mapping skills and currency to the genre (e.g., *Arcana* -> *Tech/Science* or *Wilderness Lore*; *Gold* -> *Dollars/Credits*).
   * **Custom Skill Tree / Perk Builder:** AI generates a custom 5-tier Perk Tree tailored to non-fantasy character concepts using 5e math under the hood.
   * **Tone & Lethality Sliders:** Narrative Tone (*Witty/Slapstick* to *Grimdark*) and Rules Strictness (*Rule of Cool* to *Hardcore RAW* tracking ammo/rations/encumbrance).
   * **AI World Seeder:** Uses `gemini-4-argon` to generate the starting region, 3 rival factions, 5 local rumors, and the starting node from a short prompt.
4. **Hall of Fame / Permadeath Graveyard:** No rewind button. If a character fails 3 Death Saving Throws, the campaign locks into "Fallen" state and enshrines the character in the Graveyard with cause of death, stats, and a downloadable Markdown chronicle.
5. **Universal Import / Export Engine:**
   * `.json` (Native Bundle): Full backup/restore of Characters or complete Campaigns.
   * `.md` (Markdown StoryBook): Exports the Campaign Diary, Quest Log, and Codex as a formatted, readable novel/chronicle. Also allows importing custom Markdown lore into the World Forge.
   * `5e VTT JSON`: Standard 5e character sheet import/export compatibility.
   * `Print / PDF View`: Clean Tailwind `@media print` stylesheet for physical character sheets and loot cards.

### B. 3-Tier Memory System & Lore Integrity
1. **Tier 1 — Active Context (Short-Term):** Last 10–20 turns of raw dialogue and deterministic dice roll outcomes.
2. **Tier 2 — The Campaign Diary (Mid-Term):** Auto-generated Chapter Summaries and Quest Logs written by the background Archivist.
3. **Tier 3 — The World Codex (Long-Term):** Structured JSON cards for NPCs, Companions, and Locations injected dynamically based on active location or conversation tags.
4. **"Previously On..." Session Recap:** Upon loading a saved campaign, displays a 3-bullet TV-style recap of the last session, current immediate objective, and present NPCs.
5. **Rulebook & Lore Pinboard:** Persistent drawer for custom house rules and world laws locked into the cached system prompt to prevent hallucinations.

### C. Gameplay Loop, Combat & Deterministic Mechanics
1. **Deterministic JS Dice Roller (Zero Secret DM Rolls):** The LLM never rolls dice. When a check is required, the UI pauses and displays the exact DC and modifiers. Supports both **Animated Digital d20 Rolls** and **Manual Physical Dice Input** (roll real dice at your desk and type the number).
2. **3-Mode Action Input Bar:**
   * **Guided Mode:** 3 clickable branching tactical/narrative choices with skill/DC previews.
   * **Freeform Mode:** Open text input + `[OOC]` Whisper toggle.
   * **Hybrid Mode:** Shows the 3 clickable choices directly above the open text box.
3. **NPC Dialogue "Tone & Stance" Selector:** Quick-select pills (`Diplomatic`, `Aggressive`, `Deceptive`, `Investigative`) that prime the AI and pre-select the corresponding 5e skill (`Persuasion`, `Intimidation`, `Deception`, `Insight`).
4. **Visible Enemy Tactical Cards (with Inspect/Scan):** Combat banner displays turn order, enemy distance (`Melee` / `Near` / `Far`), and visual HP tier (`Healthy` -> `Bloodied` -> `Critical`). Passing an Insight/Lore check or scanning unlocks exact AC, vulnerabilities, and traits.
5. **Tactical Stance & Quick-Action Bar:** Combat drawer with clickable cards for equipped weapons, spells, class perks, and consumables.
6. **Organic Companion System:** Party members can only be recruited organically through story events/dialogue. Recruited companions get mini stat sheets, combat turns, and a dynamic **Loyalty Meter**.
7. **"[OOC] Whisper to the DM":** Toggleable out-of-character director prompt to steer pacing or clarify a rule without breaking narrative immersion.

### D. World Simulation, Economy & Downtime
1. **Living World Clock & Timed Quests:** Travel hops, combat, and rests advance the in-game clock (`Day, Hour:Minute, Season`). Time-sensitive quests and bounties expire or resolve without the player if deadlines pass.
2. **Dynamic Weather & Environmental Modifiers:** Tied to the World Clock and region. Automatically applies mechanical modifiers (e.g., *Heavy Rain: -2 to Ranged Attacks & Perception*) in the JS Dice Engine.
3. **Interactive Node Map:** Built with React Flow. Automatically adds discovered nodes (Towns, Dungeons, Camps, Landmarks) and tracks travel times between edges.
4. **Faction Reputation & "Heat" Meters:** Visual progress bars tracking standing and notoriety with major world factions, dynamically altering NPC attitudes and bounty generation.
5. **Dynamic Loot & Crafting/Upgrade Cards:** Inventory items are structured JSON cards with equip slots, stat modifiers, and crafting tags.
6. **Interactive Merchant & Haggle Drawer:** Dedicated shop UI in hub nodes with randomized stock, 1-click buy/sell, and a once-per-visit **Haggle Roll** (`Persuasion`/`Intimidation`) to discount prices or risk getting banned.
7. **Interactive Campfire / Downtime Phase:** Clicking **Make Camp / Rest** opens a downtime phase to spend rations, craft/upgrade gear, tend wounds, or hold 1-on-1 companion conversations.
8. **Base / Safehouse Upgrader:** Claim a map node as a Home Base and spend gold/materials on permanent upgrades (e.g., *Alchemy Bench*, *Reinforced Doors*, *Lookout*) for passive rest buffs.
9. **In-World Tavern Minigames:** Built-in deterministic minigames (*Liar's Dice*, *Blackjack*, *High-Stakes Dice*) playable inside tavern nodes to win currency, extract rumors, or trigger bar fights on failed Sleight-of-Hand cheats.

### E. UI Layout & Technical Safeguards
1. **Split-Screen Command Deck:** Left/Center (60%) for Narrative Log, Enemy Cards, Dice Prompts, and Action Deck; Right (40%) for the Pinned Vitals/Clock HUD and 6-Tab Command Sidebar.
2. **Dynamic Genre Theme Switcher:** Tailwind CSS variables shift typography and color palettes per campaign (*Parchment/Serif* for Fantasy; *Gritty Ink/Slab-Serif* for Frontier/Noir; *Cyber Neon/Mono* for Sci-Fi).
3. **Token & Cost Telemetry Pill:** Live session and lifetime token counter (Input, Output, Cached) with exact USD cost calculation.
4. **Safeguard 1 — Strict `responseSchema` Enforcement:** Every Vertex AI response is locked to a strict JSON schema so UI updates never fail.
5. **Safeguard 2 — "Edit Last Turn" Anti-Glitch Button:** Allows editing/regenerating the most recent turn if the AI misreads a prompt or hallucinates.
6. **Safeguard 3 — Instant Local Rollback / Retry Queue:** Stores pending actions and dice rolls in `localStorage` before calling the API; displays a 1-click **Retry Turn** button on network timeout.
7. **Safeguard 4 — 20-Turn Auto-Archivist:** Automatically triggers `/api/archivist` in the background when the active turn buffer hits 20 turns, condensing the oldest 10 turns into the Campaign Diary and updating the World Codex.

---

## 4. Repository Folder Structure

```text
solo-rpg-engine/
├── api/                              # Vercel Serverless Functions (Vertex AI Gateway)
│   ├── dm-turn.js                    # Main turn handler (3.8 Flash / 3.6 Flash / 4 Argon)
│   ├── archivist.js                  # Background 20-turn summarizer & Codex updater
│   ├── world-forge.js                # Campaign seeder & Custom Skill/Perk Tree generator
│   └── paint-scene.js                # Imagen 3 generator -> uploads to Firebase Storage
├── src/
│   ├── components/
│   │   ├── hub/                      # Guildhall Start Screen
│   │   │   ├── GuildhallHub.jsx      # Main 3-tab start screen wrapper
│   │   │   ├── CharacterVault.jsx    # Create/clone/manage characters
│   │   │   ├── CampaignShelf.jsx     # Active campaigns + "Previously On..." modal
│   │   │   ├── WorldForgeWizard.jsx  # Genre skin, Tone sliders, AI World Seeder
│   │   │   ├── GraveyardMemorial.jsx # Permadeath Hall of Fame
│   │   │   └── ImportExportModal.jsx # .json, .md StoryBook, 5e VTT JSON, Print PDF
│   │   ├── stage/                    # Left/Center 60% Gameplay Area
│   │   │   ├── EnemyTacticalBar.jsx  # Visible Enemy Cards w/ Inspect/Scan states
│   │   │   ├── NarrativeLog.jsx      # Story feed, inline images, "Edit Last Turn" button
│   │   │   ├── DicePromptModal.jsx   # Animated d20 roller + Manual Physical Dice input
│   │   │   ├── ActionDeck.jsx        # 3-Mode Input (Guided / Freeform / Hybrid) + Stances
│   │   │   ├── MerchantDrawer.jsx    # Shop inventory & Haggle roll mechanics
│   │   │   ├── TavernMinigameModal.jsx # Liar's Dice & Blackjack minigame UI
│   │   │   └── CampfireDowntime.jsx  # Rest overlay (Crafting, Companion chat, Base upgrades)
│   │   └── sidebar/                  # Right 40% Persistent Command Deck
│   │       ├── CommandSidebar.jsx    # Sidebar wrapper & hotkey listener (Keys 1-6)
│   │       ├── PinnedVitalsHUD.jsx   # HP, AC, Conditions, World Clock, Weather Pill
│   │       ├── Tab1Character.jsx     # Stats, clickable Skills, Custom Perk Tree
│   │       ├── Tab2Inventory.jsx     # Dynamic Loot Cards, Equip slots, Quick-Craft
│   │       ├── Tab3MapFactions.jsx   # React Flow Node Map + Faction Reputation/Heat bars
│   │       ├── Tab4Quests.jsx        # Timed Quests, Bounty Board, Local Rumors
│   │       ├── Tab5DiaryCodex.jsx    # Auto-Diary Chapters, NPC/Companion cards, Lore Pinboard
│   │       └── Tab6Engine.jsx        # Model Switcher, Imagen Toggle, Theme, Cost Telemetry
│   ├── engine/                       # Pure JS Deterministic Rules Lawyer
│   │   ├── diceEngine.js             # d20 math, Advantage/Disadvantage, Weather modifiers
│   │   ├── stateMutator.js           # Applies AI JSON state_updates safely to Firestore
│   │   ├── clockWeatherEngine.js     # Advances time, calculates timed quest expirations
│   │   ├── combatEngine.js           # Initiative tracker, enemy scan logic, death saves
│   │   ├── minigames.js              # Tavern Liar's Dice / Blackjack deterministic logic
│   │   └── exporters.js              # JSON, Markdown StoryBook, and 5e VTT converters
│   ├── store/
│   │   └── useGameStore.js           # Zustand store + localStorage Retry Queue
│   ├── styles/
│   │   └── themes.css                # CSS variables for Fantasy, Frontier Noir, and Sci-Fi
│   └── firebase/
│       └── config.js                 # Firebase Auth, Firestore, Storage initialization
├── .env.example
├── package.json
├── tailwind.config.js
└── vercel.json
```

---

## 5. Cloud Firestore Database Schema

```text
users/{userId}/
  ├── characters/{charId}               # Decoupled Character Vault
  │     ├── name: string
  │     ├── genre: string
  │     ├── classOrArchetype: string
  │     ├── level: number
  │     ├── xp: number
  │     ├── status: "alive" | "fallen"
  │     ├── portraitUrl: string | null
  │     ├── stats: { str: number, dex: number, con: number, int: number, wis: number, cha: number }
  │     ├── skillProficiencies: string[]
  │     ├── vitals: {
  │     │     hp: number, maxHp: number, tempHp: number, ac: number, speed: number,
  │     │     deathSaves: { successes: number, failures: number },
  │     │     conditions: string[]
  │     │   }
  │     ├── currency: { amount: number, label: string }
  │     ├── customPerkTree: [
  │     │     { id: string, tier: number, name: string, description: string, unlocked: boolean, modifiers: object }
  │     │   ]
  │     ├── inventory: [
  │     │     { id: string, name: string, type: "weapon"|"armor"|"consumable"|"material"|"key", equipped: boolean, damageDice: string|null, statModifiers: object, craftingTags: string[], description: string }
  │     │   ]
  │     └── companionRoster: [
  │           { id: string, name: string, archetype: string, loyalty: number, hp: number, maxHp: number, ac: number, attackBonus: number, damageDice: string, isRecruited: boolean, personalityNotes: string }
  │         ]
  │
  ├── graveyard/{memorialId}            # Permadeath Hall of Fame
  │     ├── charSnapshot: object
  │     ├── campaignTitle: string
  │     ├── causeOfDeath: string
  │     ├── finalLevel: number
  │     ├── turnsSurvived: number
  │     ├── diedAt: timestamp
  │     └── markdownChronicle: string
  │
  └── campaigns/{campaignId}            # Active Campaign Shelf
        ├── meta: {
        │     title: string,
        │     genreTheme: "fantasy" | "frontier_noir" | "scifi" | "post_apoc" | "custom",
        │     toneSlider: number,       # 1 (Slapstick) to 10 (Grimdark)
        │     rulesStrictness: number,  # 1 (Rule of Cool) to 10 (Hardcore RAW)
        │     activeCharId: string,
        │     modelPref: "gemini-3.8-flash" | "gemini-3.6-flash" | "gemini-4-argon",
        │     imageMode: "off" | "manual" | "auto",
        │     actionMode: "guided" | "freeform" | "hybrid",
        │     diceMode: "digital" | "manual",
        │     status: "active" | "completed" | "fallen",
        │     lastPlayedAt: timestamp
        │   }
        ├── telemetry: {
        │     totalInputTokens: number,
        │     totalOutputTokens: number,
        │     cachedTokens: number,
        │     totalCostUSD: number
        │   }
        ├── worldState: {
        │     clock: { day: number, hour: number, minute: number, season: string },
        │     weather: { type: string, mechanicalEffect: string, modifierValue: number },
        │     currentNodeId: string,
        │     safehouse: { nodeId: string | null, name: string, upgrades: string[] }
        │   }
        ├── sessionRecap: {
        │     bullets: string[],
        │     immediateObjective: string,
        │     presentNPCs: string[]
        │   }
        ├── lorePinboard: string[]
        ├── factions: [
        │     { id: string, name: string, description: string, reputation: number, heat: number, status: string }
        │   ]
        ├── mapNodes: [
        │     { id: string, label: string, type: "town"|"dungeon"|"camp"|"safehouse"|"landmark", position: { x: number, y: number }, discovered: boolean, connectedTo: [{ targetNodeId: string, travelMinutes: number }], shopStock: array, rumors: array }
        │   ]
        ├── quests: [
        │     { id: string, title: string, description: string, type: "main"|"bounty"|"rumor", status: "active"|"completed"|"failed", deadline: { day: number, hour: number } | null, rewards: array }
        │   ]
        ├── turns/{turnId}              # Tier 1 Memory: Short-Term Buffer (Max 20 active turns)
        ├── diary/{chapterId}           # Tier 2 Memory: Mid-Term Auto-Summarized Chapters
        └── codex/{entityId}            # Tier 3 Memory: Long-Term NPCs & Locations (with search tags)
```

---

## 6. Vertex AI Structured Output Contract (`responseSchema`)

Every request to `/api/dm-turn.js` enforces the following JSON schema via Vertex AI `generationConfig.responseSchema`:

```json
{
  "type": "OBJECT",
  "required": [
    "narrative_text",
    "scene_visual_prompt",
    "roll_request",
    "combat_state",
    "state_updates",
    "guided_choices"
  ],
  "properties": {
    "narrative_text": {
      "type": "STRING",
      "description": "Rich second-person RPG narrative response describing the outcome and current scene."
    },
    "scene_visual_prompt": {
      "type": "STRING",
      "description": "Detailed art prompt matching the campaign genre aesthetic in case the user triggers Imagen 3."
    },
    "dialogue_npc": {
      "type": "OBJECT",
      "nullable": true,
      "properties": {
        "id": { "type": "STRING" },
        "name": { "type": "STRING" },
        "attitude": { "type": "STRING" }
      }
    },
    "roll_request": {
      "type": "OBJECT",
      "required": ["required"],
      "properties": {
        "required": { "type": "BOOLEAN" },
        "skill_or_stat": { "type": "STRING", "nullable": true },
        "dc": { "type": "INTEGER", "nullable": true },
        "advantage_state": { "type": "STRING", "enum": ["normal", "advantage", "disadvantage"], "nullable": true },
        "reason": { "type": "STRING", "nullable": true }
      }
    },
    "combat_state": {
      "type": "OBJECT",
      "required": ["in_combat", "enemies"],
      "properties": {
        "in_combat": { "type": "BOOLEAN" },
        "round": { "type": "INTEGER" },
        "enemies": {
          "type": "ARRAY",
          "items": {
            "type": "OBJECT",
            "required": ["id", "name", "distance", "health_tier", "inspected"],
            "properties": {
              "id": { "type": "STRING" },
              "name": { "type": "STRING" },
              "distance": { "type": "STRING", "enum": ["Melee", "Near", "Far"] },
              "health_tier": { "type": "STRING", "enum": ["Healthy", "Injured", "Bloodied", "Critical", "Defeated"] },
              "inspected": { "type": "BOOLEAN" },
              "revealed_ac": { "type": "INTEGER", "nullable": true },
              "revealed_traits": { "type": "ARRAY", "items": { "type": "STRING" } }
            }
          }
        }
      }
    },
    "state_updates": {
      "type": "OBJECT",
      "properties": {
        "hp_delta": { "type": "INTEGER" },
        "currency_delta": { "type": "INTEGER" },
        "xp_delta": { "type": "INTEGER" },
        "time_advance_minutes": { "type": "INTEGER" },
        "weather_change": {
          "type": "OBJECT",
          "nullable": true,
          "properties": {
            "type": { "type": "STRING" },
            "mechanicalEffect": { "type": "STRING" },
            "modifierValue": { "type": "INTEGER" }
          }
        },
        "faction_deltas": {
          "type": "ARRAY",
          "items": {
            "type": "OBJECT",
            "properties": {
              "faction_id": { "type": "STRING" },
              "rep_delta": { "type": "INTEGER" },
              "heat_delta": { "type": "INTEGER" }
            }
          }
        },
        "loot_gained": { "type": "ARRAY", "items": { "type": "OBJECT" } },
        "loot_removed_ids": { "type": "ARRAY", "items": { "type": "STRING" } },
        "new_map_node": { "type": "OBJECT", "nullable": true },
        "companion_updates": { "type": "ARRAY", "items": { "type": "OBJECT" } },
        "codex_upserts": { "type": "ARRAY", "items": { "type": "OBJECT" } }
      }
    },
    "guided_choices": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "required": ["label", "stance"],
        "properties": {
          "label": { "type": "STRING" },
          "stance": { "type": "STRING", "enum": ["Diplomatic", "Aggressive", "Deceptive", "Investigative", "Tactical"] },
          "default_skill": { "type": "STRING", "nullable": true },
          "estimated_dc": { "type": "INTEGER", "nullable": true }
        }
      }
    }
  }
}
```

---

## 7. Phased Implementation Roadmap

### Phase 1: Core Skeleton, Theme Engine & Guildhall Hub
* Initialize Vite + React + Tailwind CSS project and configure Firebase (`Auth`, `Firestore`, `Storage`).
* Build `themes.css` supporting dynamic CSS variable switching (`Fantasy Parchment`, `Frontier Comic-Noir`, `Sci-Fi Neon`).
* Build the **Guildhall Hub**:
  * **Character Vault:** Full creation wizard, stat allocation, custom Perk Tree viewer, and character cloning.
  * **Campaign Shelf & World Forge Wizard:** Genre skin selector, skill/currency mapper, tone/lethality sliders, and AI World Seeder endpoint (`/api/world-forge.js`).
  * **Universal Import/Export Modal:** `.json` bundle parser/exporter, `.md` StoryBook generator, 5e JSON importer, and `@media print` sheet view.

### Phase 2: Vertex AI Gateway, Telemetry & Deterministic Turn Loop
* Build `/api/dm-turn.js` connecting to Google Cloud Vertex AI with live model switching (`gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-4-argon`) and Context Caching.
* Build the **Stage Area (Left 60%)**:
  * `NarrativeLog.jsx` with inline scene rendering and the **Edit Last Turn** button.
  * `DicePromptModal.jsx` and `diceEngine.js` supporting animated Digital d20 rolls and Manual Physical Dice input.
  * `ActionDeck.jsx` with the 3-Mode Selector (`Guided 3-Choices`, `Freeform`, `Hybrid`), Dialogue Stance pills, and `[OOC]` DM Whisper toggle.
  * Local `localStorage` Rollback/Retry Queue for API timeout recovery.
  * Live **Token & Cost Telemetry** calculator in Zustand + Firestore.

### Phase 3: The 6-Tab Command Sidebar & World Simulation
* Build `PinnedVitalsHUD.jsx` (HP, AC, Conditions, Living World Clock, and Weather modifier pill).
* Build the 6 quick-switch tabs (with keyboard shortcuts `1`–`6`):
  * **Tab 1 (Character):** Clickable skills for instant rolls + Custom Perk Tree progression.
  * **Tab 2 (Inventory & Crafting):** Dynamic Loot Cards, Equip/Unequip toggles, and Quick-Craft combiner.
  * **Tab 3 (Map & Factions):** `@xyflow/react` interactive Node Map (click connected node to travel & advance clock) + Faction Reputation & Heat bars.
  * **Tab 4 (Quests & Bounties):** Active quests with live clock countdowns for timed objectives + Rumor Mill.
  * **Tab 5 (Diary & Codex):** Chapter reader, searchable NPC/Location Codex cards, Companion Loyalty bars, and the **Rulebook & Lore Pinboard**.
  * **Tab 6 (Engine & Telemetry):** Model Switcher, Imagen 3 mode toggle, Theme Switcher, and API cost table.

### Phase 4: Combat, Companions & Economy Modules
* Build `EnemyTacticalBar.jsx` displaying enemy turn order, range, health tiers, and the **Inspect/Scan** check mechanic.
* Build the **Tactical Action Bar** drawer for 1-click weapon/perk/consumable execution in combat.
* Build `MerchantDrawer.jsx` with shop stock generation and the once-per-visit **Haggle Roll**.
* Build `CampfireDowntime.jsx` for ration consumption, gear crafting, companion loyalty dialogues, and **Safehouse Upgrades**.
* Build `TavernMinigameModal.jsx` with playable *Liar's Dice* and *Blackjack* modules.

### Phase 5: 3-Tier Memory Archivist, Imagen 3 & Permadeath Graveyard
* Build `/api/archivist.js` triggered automatically whenever `turns` count reaches `20`, summarizing the oldest 10 turns into `diary/{chapterId}`, updating `codex/{entityId}`, and refreshing the **"Previously On..."** session recap.
* Build `/api/paint-scene.js` integrating `imagen-3.0-generate-002` with Firebase Storage upload and the `Off / Manual / Auto` toggle.
* Build `combatEngine.js` Death Saving Throw tracker—upon 3 failed saves, automatically locks the campaign, generates the final Markdown Chronicle, and inducts the character into `GraveyardMemorial.jsx`.