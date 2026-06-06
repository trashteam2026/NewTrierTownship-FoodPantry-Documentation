---
id: deployment
title: Deployment
sidebar_position: 3
---

# Deployment

The frontend is a Vite build hosted on Firebase Hosting. Every push to `main` triggers a GitHub Actions workflow that builds the app and deploys the hosting site. The Cloud Function that serves the API is deployed from the backend repo, not here.

For running and building the app locally, see [../getting-started](../getting-started). For the source layout, see [./project-structure](./project-structure). For the API function that hosting routes to, see [../backend/deployment](../backend/deployment).

## Build

The build command is defined in `package.json`:

```json
"scripts": {
  "build": "vite build"
}
```

`npm run build` runs `vite build`. Vite writes the output to `dist/`. The Vite config (`vite.config.js`) does not override the output directory, so the default `dist/` applies.

## Hosting config

`firebase.json` configures Firebase Hosting:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/auth/**", "function": "api", "region": "us-central1" },
      { "source": "/categories/**", "function": "api", "region": "us-central1" },
      { "source": "/items/**", "function": "api", "region": "us-central1" },
      { "source": "/activity/**", "function": "api", "region": "us-central1" },
      { "source": "/api/**", "function": "api", "region": "us-central1" },
      { "source": "/health", "function": "api", "region": "us-central1" },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

`public` is `dist`, so Firebase serves the Vite build output.

The rewrites route requests in order:

- `/auth/**`, `/categories/**`, `/items/**`, `/activity/**`, `/api/**`, and `/health` all route to the Cloud Function named `api` in region `us-central1`. These six entries send those API calls to the same function.
- `**` is the SPA fallback. Every other path serves `/index.html`, so the React router handles it in the browser.

## Project

`.firebaserc` sets the default Firebase project:

```json
{
  "projects": {
    "default": "food-pantry-5fdb0"
  }
}
```

The default project id is `food-pantry-5fdb0`.

## GitHub Actions workflow

The workflow file is `.github/workflows/deploy.yml`. Its name is `Deploy Frontend to Firebase Hosting`. It triggers on push to `main`:

```yaml
on:
  push:
    branches: [main]
```

The job runs on `ubuntu-latest`. Steps in order:

1. **Checkout** with `actions/checkout@v4`.
2. **Setup Node 22** with `actions/setup-node@v4`, `node-version: '22'`, npm cache on.
3. **Install dependencies** with `npm ci`.
4. **Build** with `npm run build`. This step sets 8 `VITE_` env vars from GitHub Actions secrets:
   - `VITE_BACKEND_URL`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`
5. **Authenticate to Google Cloud** with `google-github-actions/auth@v3`, using the `FIREBASE_SERVICE_ACCOUNT` secret as `credentials_json`. This writes the service account JSON and exports Application Default Credentials for the next steps.
6. **Install Firebase CLI** pinned to a version: `npm install -g firebase-tools@15.19.1`.
7. **Deploy hosting** with this command:

```bash
firebase deploy --only hosting --project food-pantry-5fdb0 --non-interactive
```

`--only hosting` scopes the deploy to hosting, so it does not touch functions. `--project food-pantry-5fdb0` targets the project. `--non-interactive` blocks prompts.

## Environment at build time

Vite inlines `VITE_`-prefixed vars into the bundle during `vite build`. The 8 vars above come from GitHub Actions secrets at build time.

`.env.production` in the repo sets only one var:

```
VITE_BACKEND_URL=https://api-72x3pmgaba-uc.a.run.app
```

The 7 `VITE_FIREBASE_*` vars are not in the repo. They come from secrets only.

`src/firebase-config.js` reads all 7 Firebase vars from `import.meta.env`:

```js
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
```

A local build without the 7 Firebase vars set produces a bundle where these config values are `undefined`. See [../gotchas](../gotchas).

## Deploy manually

The workflow runs the same command you can run from a machine with the Firebase CLI installed and authenticated to the project:

```bash
firebase deploy --only hosting --project food-pantry-5fdb0
```

This needs the Firebase CLI and auth to the `food-pantry-5fdb0` project. It builds nothing on its own, so run `npm run build` first to refresh `dist/`.
