# CLAUDE.md — Operational Instructions & Coding Rules

You are the lead full-stack engineer building the **Solo RPG Engine** defined in this blueprint. Always adhere strictly to these development rules:

## 1. Non-Negotiable Coding Standards
* **Full Copy-Pasteable Files Only:** NEVER use placeholders like `// ... rest of code here`, `// TODO: implement`, or truncated functions. Every file you create or modify must be 100% complete and production-ready.
* **Strict Separation of Concerns:**
  * **The Frontend (`src/engine/*`) is the Deterministic Rules Lawyer:** All dice math (`d20 + statMod + proficiency + weatherMod + itemMod`), HP/currency clamping, clock progression, timed quest expiration checks, and minigames MUST run deterministically in pure JavaScript. Never let the LLM roll dice or calculate math.
  * **The Backend (`api/*`) is the Storyteller & State Proposer:** All calls to Google Cloud Vertex AI go through Vercel Serverless Functions using `@google-cloud/vertexai` (or `@google/genai` configured for Vertex AI), enforcing the exact `responseSchema` defined in Section 6.
* **No Prohibited Mechanics:**
  * NO secret/hidden DM rolls (all DCs, modifiers, and roll triggers are visible to the player).
  * NO timeline rewind / multiverse branching (permadeath on 3 failed Death Saves is final; only the "Edit Last Turn" anti-glitch button is permitted on the most recent message).
  * NO manual "Add Companion" button (companions can only be toggled to `isRecruited: true` organically via story state updates).
  * NO ambient audio/soundboard modules.

## 2. Environment Variables Expected (`.env.local` / Vercel)
* **Frontend (Vite):**
  * `VITE_FIREBASE_API_KEY`
  * `VITE_FIREBASE_AUTH_DOMAIN`
  * `VITE_FIREBASE_PROJECT_ID`
  * `VITE_FIREBASE_STORAGE_BUCKET`
  * `VITE_FIREBASE_MESSAGING_SENDER_ID`
  * `VITE_FIREBASE_APP_ID`
* **Backend (Vercel Serverless - Google Cloud Vertex AI):**
  * `GCP_PROJECT_ID`
  * `GCP_LOCATION` (default: `us-central1` or `europe-west1`)
  * `GCP_SERVICE_ACCOUNT_KEY` (Base64-encoded or stringified JSON service account key for Vertex AI & Imagen 3)

## 3. UI & UX Polish Requirements
* Use **Tailwind CSS** coupled with CSS custom properties in `src/styles/themes.css` so switching between `fantasy` (warm parchment, crimson accents, serif headings), `frontier_noir` (stark cream/charcoal, high-contrast ink borders, slab-serif headings), and `scifi` (deep slate/obsidian, cyan/emerald neon accents, monospace headings) dynamically restyles the entire app without page reloads.
* Maintain the **60% Left/Center Stage / 40% Right Command Sidebar** split-screen layout on desktop, with hotkeys `1`–`6` bound to switch sidebar tabs when not typing in an input field.
* Ensure the **Local Retry Queue** writes pending turn actions to `localStorage` before firing `/api/dm-turn` and clears them only after Firestore successfully commits `stateMutator.js` updates.