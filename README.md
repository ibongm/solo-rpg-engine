# Solo RPG Engine

An AI-driven, single-player tabletop role-playing game engine combining a strictly deterministic frontend rules lawyer with an evocative generative AI storyteller backend.

---

## Architecture Overview

* **Deterministic Rules Engine (`src/engine/`):** Executes all dice mechanics (`d20 + modifiers`), health points, currency clamping, clock/calendar progression, quest timers, and minigames in pure JavaScript without LLM hallucinations.
* **Storyteller & World Engine (`api/`):** Vercel Serverless Functions communicating with Google Cloud Vertex AI (Gemini and Imagen), enforcing structured JSON schemas for narrative progression and tactical encounters.
* **Dynamic Multi-Genre Theming (`src/styles/themes.css`):** Fluid runtime switching across Fantasy, Frontier Noir, and Sci-Fi genres using Tailwind CSS and CSS custom properties.
* **Resilient State & Offline Queuing (`src/store/`):** Local action retry queue persisting uncommitted turn steps to `localStorage` before synchronizing with Firebase Firestore.

---

## Quickstart

### Prerequisites
* **Node.js:** version 22.12 or higher (24 LTS recommended)
* **Java:** version 11 or higher (required for Firebase Local Emulators)

### Installation & Local Run
```bash
# 1. Install dependencies
npm install

# 2. Run Firebase Emulators (Terminal 1)
npm run emulators

# 3. Start local development server (Terminal 2)
npm run dev
```

For full environment configuration (Firebase cloud project, Google Cloud Vertex AI service accounts, and Vercel deployment), see the [Setup Guide](docs/SETUP.md).

---

## Documentation

* **[Setup Guide](docs/SETUP.md):** Detailed guide for local emulator mode, Firebase configuration, Google Cloud service accounts, and Vercel deployment.
* **[RPG Blueprint](docs/rpg-blueprint.md):** Full technical specification, game mechanics, state machine, and data schema definitions.
* **[Agent & Contributor Rules](AGENTS.md):** Development guidelines, non-negotiable coding standards, and prohibited mechanics.
* **[Changelog](CHANGELOG.md):** History of releases, structural changes, and updates.
* **[Notice](docs/NOTICE.md):** Legal and license notices.

---

## Scripts

* `npm run dev`: Launch Vite local development server.
* `npm run dev:full`: Launch Vercel development environment with serverless functions.
* `npm run build`: Compile and bundle production assets with Vite.
* `npm run test`: Run unit test suite using Vitest.
* `npm run emulators`: Start Firebase local emulator suite.
