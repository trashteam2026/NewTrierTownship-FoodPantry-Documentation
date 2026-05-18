---
id: getting-started
title: Getting Started
sidebar_position: 2
---

# Getting Started

The New Trier Food Pantry inventory system is split across two application repositories:

- `js-frontend`: React/Vite client for administrators and volunteers.
- `js-backend`: Express API server connected to Supabase/PostgreSQL and Firebase.

This documentation site is a separate Docusaurus repository used for handoff notes and project knowledge. It should describe how the project works, but it should not contain secrets, production credentials, or private environment values.

## Local Repositories

During development, it is helpful to keep all three repositories side by side:

```text
DISC/
  js-frontend/
  js-backend/
  Food-Documentation-Website/
```

The frontend and backend are independent Node projects. Install dependencies separately in each project:

```bash
cd js-backend
npm install

cd ../js-frontend
npm install
```

## Running Locally

Start the backend first:

```bash
cd js-backend
npm run dev
```

The backend defaults to port `5050`.

Then start the frontend:

```bash
cd js-frontend
npm run dev
```

The frontend usually runs at:

```text
http://localhost:5173
```

Use `http`, not `https`, unless the Vite dev server has been explicitly configured for HTTPS.

## Environment Files

The backend uses `.env` for:

- `DATABASE_URL`
- Firebase service account data
- allowed frontend URLs
- barcode lookup provider configuration

The frontend uses `.env` for:

- `VITE_BACKEND_URL`
- Firebase browser client configuration

Do not commit real `.env` files. Keep `.env.example` files updated when new variables are introduced.

## Useful Checks

Frontend production build:

```bash
cd js-frontend
npm run build
```

Backend lint:

```bash
cd js-backend
npm run lint
```

Documentation site local server:

```bash
cd Food-Documentation-Website
npm install
npm start
```

Deployment documentation can be added later once the production hosting path is finalized.
