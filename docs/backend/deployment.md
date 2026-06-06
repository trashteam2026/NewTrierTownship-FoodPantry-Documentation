---
id: deployment
title: Deployment
sidebar_position: 3
---

# Deployment

The backend deploys as a single Firebase Cloud Function (gen 2). The function wraps the Express app and serves every backend route. To run the backend locally, see [Getting Started](../getting-started). For how the Express app and the function entry point are split, see [Project Structure](./project-structure).

## The function

`index.js` is the function entry point. It imports the Express app from `src/app.js` and exports it as an HTTPS function named `api`:

```js
import { onRequest } from 'firebase-functions/v2/https';

import app from './src/app.js';

export const api = onRequest(
  {
    region: 'us-central1',
    secrets: [
      'DATABASE_URL',
      'FRONTEND_URL',
      'FRONTEND_URL_DEV',
      'OPEN_FOOD_FACTS_USER_AGENT',
      'OWNER_EMAILS',
    ],
  },
  app
);
```

The function uses `onRequest` from `firebase-functions/v2/https`. The region is `us-central1`. The function declares five runtime secrets: `DATABASE_URL`, `FRONTEND_URL`, `FRONTEND_URL_DEV`, `OPEN_FOOD_FACTS_USER_AGENT`, and `OWNER_EMAILS`. These are injected as environment variables at runtime.

`NODE_ENV` and the Firebase credentials behavior are set in config, not here. For the environment variables the app reads, see [Getting Started](../getting-started).

## firebase.json

`firebase.json` configures the function build:

```json
{
  "functions": {
    "source": ".",
    "runtime": "nodejs22",
    "ignore": [
      "node_modules",
      ".git",
      "firebase-debug.log",
      "firebase-debug.*.log",
      ".env",
      ".env.*",
      "*.ini",
      ".DS_Store",
      "migrations",
      "sql"
    ]
  }
}
```

The functions source is the backend root (`.`). The runtime is `nodejs22`. The `ignore` list excludes `node_modules`, `.git`, the `firebase-debug` logs, `.env` and `.env.*`, `*.ini`, `.DS_Store`, `migrations`, and `sql` from the deploy bundle.

## .firebaserc

`.firebaserc` sets the default project:

```json
{
  "projects": {
    "default": "food-pantry-5fdb0"
  }
}
```

The default project id is `food-pantry-5fdb0`.

## GitHub Actions workflow

`.github/workflows/deploy.yml` is named `Deploy Firebase Functions`. It triggers on push to `main`. The job runs on `ubuntu-latest` with these steps in order:

1. **Checkout** with `actions/checkout@v4`.
2. **Setup Node 22** with `actions/setup-node@v4`, `node-version: '22'`, npm cache on.
3. **Install dependencies** with `npm ci`.
4. **Authenticate to Google Cloud** with `google-github-actions/auth@v3`, passing `credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}`. This writes the service account JSON to a temp file and exports `GOOGLE_APPLICATION_CREDENTIALS` for the later steps.
5. **Install Firebase CLI** pinned to `firebase-tools@15.19.1` via `npm install -g`.
6. **Deploy functions** with the command below.

The deploy command:

```bash
firebase deploy --only functions --project food-pantry-5fdb0 --non-interactive
```

A comment in the workflow states that `--force` is omitted on purpose, so an unexpected destructive change (such as a function deletion) fails the run instead of being applied. `CI=true` is set by GitHub Actions, and `--non-interactive` blocks prompts.

## Deploy manually

The workflow runs the deploy on every push to `main`. To deploy by hand, run the same CLI command the workflow runs:

```bash
firebase deploy --only functions --project food-pantry-5fdb0 --non-interactive
```

This needs the Firebase CLI installed and authentication to the `food-pantry-5fdb0` project.

## Secrets at runtime

`DATABASE_URL` and the other declared secrets are not committed. They live in Secret Manager and are injected into the function as environment variables at runtime through the `secrets` list in `index.js`. The `ignore` list in `firebase.json` keeps `.env` and `.env.*` out of the deploy bundle.

For local environment setup, see [Getting Started](../getting-started). For what `DATABASE_URL` connects to, see [Database Schema](../database-schema).
