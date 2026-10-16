# Solo RPG Engine — Setup Guide

There are three ways to run the engine. Each one builds on the previous.

1. **Local, no accounts.** Runs on Firebase emulators with a mock storyteller. It works today.
2. **Real Firebase plus real Vertex AI, run locally.**
3. **Deployed to Vercel.**

---

## 0. Prerequisites

- **Node.js 22.12+** (24 LTS recommended), which gives you `npm`.
- **Java 11+.** The Firebase emulators need it.
- **Dependencies:** run `npm install` once.

---

## 1. Local mode (no cloud accounts)

`.env.local` is already configured for this mode:

```env
VITE_USE_EMULATORS=true
VITE_FIREBASE_PROJECT_ID=demo-solo-rpg
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=localhost
VITE_FIREBASE_STORAGE_BUCKET=demo-solo-rpg.appspot.com
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
VERTEX_MOCK=1
```

Run it in two terminals:

```bash
npm run emulators   # terminal 1: Auth, Firestore, Storage (+ UI at http://127.0.0.1:4000)
npm run dev         # terminal 2: app + /api routes at http://localhost:5173
```

When you click **Sign in with Google**, the emulator shows a fake-account screen. Choose **Add new account**, then **Auto-generate user information**.

With `VERTEX_MOCK=1`, every AI route returns canned responses that pass schema validation. The full game loop works this way: dice prompts, combat, loot, companions, quests, the Archivist, scene images and permadeath. The prose is placeholder text.

Emulator data is wiped whenever the emulators stop.

---

## 2. Firebase project (Auth, Firestore, Storage)

1. Go to <https://console.firebase.google.com>, click **Add project**, and name it (for example `solo-rpg`). You can skip Google Analytics.
2. **Authentication:**
   1. Open **Build → Authentication → Get started**.
   2. Under **Sign-in method**, enable **Google** and pick a support email.
   3. Under **Settings → Authorized domains**, add your Vercel domain later (for example `your-app.vercel.app`). `localhost` is already listed.
3. **Firestore:**
   1. Open **Build → Firestore Database → Create database**.
   2. Pick a location near you and choose **production mode**.
   3. Open the **Rules** tab, paste the contents of `firestore.rules` from this repo, and click **Publish**.
4. **Storage:**
   1. Open **Build → Storage → Get started**. This may ask you to upgrade to the Blaze plan.
   2. Open the **Rules** tab, paste `storage.rules`, and click **Publish**.
5. **Web app keys:**
   1. Open **Project settings** (gear icon) → **General → Your apps** and click the **`</>`** web icon.
   2. Register the app; you don't need Firebase Hosting.
   3. Copy the `firebaseConfig` values into `.env.local`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

6. Delete or comment out the emulator lines (`VITE_USE_EMULATORS` and the three `*_EMULATOR_HOST` lines) in `.env.local`.

---

## 3. Google Cloud Vertex AI

A Firebase project **is** a Google Cloud project, so you can use the same one.

1. Open <https://console.cloud.google.com> and select your Firebase project.
2. **Enable billing.** Go to **Billing** and link a billing account. Vertex AI requires it.
3. **Enable the API.** Go to **APIs & Services → Library**, search for **Vertex AI API** (`aiplatform.googleapis.com`), and click **Enable**.
4. **Create a service account:**
   1. Go to **IAM & Admin → Service Accounts → Create service account**. A name like `solo-rpg-server` works.
   2. Grant these roles:
      - **Vertex AI User** (`roles/aiplatform.user`): text and image generation, plus context caches.
      - **Storage Object Admin** (`roles/storage.objectAdmin`): uploads scene paintings to the Firebase Storage bucket.
   3. Click **Done**.
5. **Create a key:**
   1. Open the service account, then **Keys → Add key → Create new key → JSON**. A `.json` file downloads.
   2. **Treat it like a password.** Never commit it; `.gitignore` already excludes `.env*`.
6. **Encode the key** as one line. Either option works.

   Option A, Base64 (recommended):

   ```bash
   # macOS / Linux / Git Bash
   base64 -w0 path/to/key.json        # macOS: base64 -i path/to/key.json
   ```

   ```powershell
   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\key.json"))
   ```

   Option B, raw JSON: paste the whole file contents on one line.

7. Add these lines to `.env.local`:

```env
GCP_PROJECT_ID=your-project
GCP_LOCATION=global
GCP_SERVICE_ACCOUNT_KEY=<the base64 string>
```

8. Remove `VERTEX_MOCK=1` and restart `npm run dev`.

### Models in use

All model settings live in `src/config/models.js`.

| Role | Model ID | Notes |
|---|---|---|
| Default storyteller | `gemini-3.8-flash` | Stable until at least Sep 2027. Explicit context caching enabled. Served from `global` (404 in `us-central1`). |
| Fast fallback | `gemini-3.7-flash` | Replaces the blueprint's `gemini-3.6-flash`, which retires 2026-11-19. This one retires 2027-01-28. |
| Heavy reasoning / world seeding | `gemini-4-argon` | Routed to the `global` endpoint. Implicit caching only; temperature is ignored. |
| Scene images | `gemini-3.1-flash-image` | Replaces `imagen-3.0-generate-002`, which is discontinued on Vertex. |

Prices in `src/config/models.js` include introductory rates: Argon until 2026-11-30, and the Flash models until 2026-12-31. Check them against <https://cloud.google.com/vertex-ai/generative-ai/pricing> when they change. Only the cost telemetry uses these numbers.

If Vertex returns *model not found*, check the model ID and its region on <https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions>. Then edit `location` in `src/config/models.js` or `GCP_LOCATION`.

---

## 4. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. On <https://vercel.com>, click **Add New → Project**, then import the repository. It detects Vite on its own; `vercel.json` sets the build and function timeouts.
3. Under **Settings → Environment Variables**, add these keys for Production and Preview:
   - All six `VITE_FIREBASE_*` keys
   - `GCP_PROJECT_ID`, `GCP_LOCATION` and `GCP_SERVICE_ACCOUNT_KEY`

   **Do not** add `VITE_USE_EMULATORS`, the `*_EMULATOR_HOST` keys or `VERTEX_MOCK`.
4. Deploy. Then add the `*.vercel.app` domain to **Firebase → Authentication → Settings → Authorized domains**.

---

## 5. Checking that it works

- **Unit tests:** run `npm test`. All deterministic engine modules are covered: dice, mutator, clock, combat, economy, minigames, exporters and context.
- **Production build:** run `npm run build`.
- **Live AI check:** sign in, create a character, and forge a world. Try each of the three models from **Tab 6 → Storyteller Model**. The telemetry pill in the header should show non-zero tokens and cost after each turn.
