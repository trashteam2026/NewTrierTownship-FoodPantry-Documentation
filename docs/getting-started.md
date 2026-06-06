---
id: getting-started
title: Getting Started
sidebar_position: 2
---

# Getting Started

The system is split across two repositories. `js-frontend` is the React app built with Vite, and `js-backend` is the Express API. Behind them sit a Supabase Postgres database for data and Firebase for authentication, hosting, and Cloud Functions.

## Credentials

The GitHub account, the Supabase access, and the Firebase access are not stored in this repository. They were given to the client in a separate handoff document. Get them from there before you start. The Firebase project is `food-pantry-5fdb0`.

## Prerequisites

- Node 22. The backend pins this in `package.json` under `engines.node`. The frontend has no `engines` field, but its CI workflow runs on Node 22, so use Node 22 for both.
- Git.
- A code editor.
- Access to the Firebase project `food-pantry-5fdb0` and the Supabase project, per the handoff document.

## Clone the repositories

```bash
git clone https://github.com/trashteam2026/js-frontend.git
git clone https://github.com/trashteam2026/js-backend.git
```

## Backend setup

Move into the backend and install dependencies:

```bash
cd js-backend
npm install
```

Create a `.env` file in `js-backend`. The code reads these variables:

- `DATABASE_URL` (required). The Supabase Postgres connection string. The connection details come from the handoff document. The pool in `src/config/database.js` is sized for the Supabase transaction pooler on port 6543, so use the transaction pooler connection string.
- `FIREBASE_SERVICE_ACCOUNT_KEY` (optional). A service account key as JSON. If it is empty or unset, `src/config/firebase.js` falls back to Application Default Credentials, which is the expected case on Cloud Functions.
- `FRONTEND_URL` (CORS). An allowed frontend origin.
- `FRONTEND_URL_DEV` (CORS). A second allowed frontend origin for development.
- `NODE_ENV`. Set the run mode. In `production` the error handler hides error messages.
- `PORT` (optional). The local listen port. Defaults to `5050`. This is used by the local dev server only; Cloud Functions manages its own port.
- `OPEN_FOOD_FACTS_USER_AGENT` (optional). The User-Agent sent to Open Food Facts. Defaults to `disc-food-pantry/1.0`.
- `UPCITEMDB_API_KEY` (optional). A key for UPCitemdb. If unset, the barcode lookup uses the keyless trial.

`OWNER_EMAILS` is legacy. The code does not read it. Owner status comes from the `owners` table in the database. See [Authentication](./authentication).

Run the backend:

```bash
npm run dev
```

That runs `node src/server.js`. It listens on `PORT`, which defaults to `5050`.

## Frontend setup

Move into the frontend and install dependencies:

```bash
cd js-frontend
npm install
```

Create a `.env` file (or `.env.local`) in `js-frontend`. Set the backend URL and the Firebase web config:

- `VITE_BACKEND_URL`. The backend base URL, for example `http://localhost:5050`. This must be set. `src/common/utils/backendUrl.js` throws if it is missing or blank.
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

These seven Firebase names are read in `src/firebase-config.js`.

Run the frontend:

```bash
npm run dev
```

That runs Vite. Vite serves the app at `http://localhost:5173` by default.

Build the frontend:

```bash
npm run build
```

That runs `vite build` and outputs static files to `dist/`.

## Database

The canonical schema is `js-backend/sql/schema.sql`. It is the one file needed for a fresh database. Run it once against an empty Postgres database, for example in the Supabase SQL Editor, and it reproduces the current schema. Older migrations live in `js-backend/migrations/` and `js-backend/sql/migrations/`; the schema file consolidates and supersedes them.

There is no migrate script in `package.json`. The SQL is applied directly against the database, such as through the Supabase SQL Editor. For the table layout, see [Database Schema](./database-schema).

## Verify

- Backend: send a request to `GET /health`. It returns `{"status":"ok"}`.
- Frontend: open the Vite dev URL, `http://localhost:5173` by default.
- Owner login: the signed-in email must exist in the `owners` table, or owner-only routes stay locked. See [Authentication](./authentication).
