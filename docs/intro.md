---
id: intro
title: Introduction
sidebar_position: 1
slug: /
---

# New Trier Township Food Pantry Inventory System

This site documents the New Trier Township Food Pantry inventory system: what it does, how to run it, and how it is built. The stated goal of the project is to replace the pantry's spreadsheet-based process with a web app that tracks stock as it moves.

## Overview

The system tracks what the pantry has in stock and who changes it. Owners run the pantry. They manage the inventory and check items out to clients. Volunteers help by scanning new stock in. A volunteer joins a live session with an access code, so no volunteer account is needed.

The system does the following:

- **Scan items in**: Volunteers scan a barcode to add stock, or add an item by hand (ScanInPage).
- **View inventory**: Owners see items grouped into food and non-food categories, with low stock and out of stock flags, search, and sorting (InventoryPage).
- **Check items out**: Owners scan items to remove stock. Stock leaves in first-expired order (ScanOutPage).
- **Review activity**: Owners review what was added and removed, filter by date range, and search by item (ActivityLogPage).
- **Print barcode labels**: Owners create an item, generate its barcode, and print labels (BarcodeGeneratorPage).
- **Manage volunteer sessions**: Owners open a session and share an access code. They see who is active and a history of scan-ins (VolunteersPage).
- **Sign in by role**: Firebase Auth separates owners from volunteers. Owners sign in with an account. Volunteers join with a session code.

## Tech Stack

The system is JavaScript across two repositories, `js-frontend` and `js-backend`.

### Frontend

- React (`^19.2.0`)
- Vite (`^7.2.4`) as the build tool
- React Router (`^7.11.0`)
- styled-components (`^6.1.19`)
- @zxing/browser (`^0.1.5`) for barcode scanning
- Firebase JS SDK (`firebase ^12.7.0`)

Vite builds the app to `dist/`. The site is hosted on Firebase Hosting.

### Backend

- Node 22
- Express 5 (`express ^5.2.1`), running as ES modules
- pg (`^8.13.0`) for Postgres
- firebase-admin (`^13.6.0`)
- firebase-functions (`^6.0.0`)

The backend deploys as a Firebase Cloud Function (gen 2). `index.js` exports one HTTPS function named `api` using `onRequest` from `firebase-functions/v2/https`, in region `us-central1`. The database is Supabase Postgres. A MySQL provider exists in the code as an alternate path, but Postgres is the active one.

### Development Tools

- Git for version control
- VS Code as the recommended editor
- ESLint and Prettier for code formatting

## Where to go next

Read [Getting Started](./getting-started) to run the system, then read [Authentication](./authentication) to set up owner and volunteer access.
