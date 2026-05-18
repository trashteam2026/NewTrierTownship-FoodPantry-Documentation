---
title: Backend Project Structure
sidebar_position: 1
---

# Backend Project Structure

The backend repository is:

```text
js-backend/
```

It is a Node/Express API server that currently uses Supabase/PostgreSQL through the `pg` package.

## Top-Level Files

```text
js-backend/
  package.json
  src/
  sql/
  .env.example
```

Useful scripts:

```bash
npm run dev
npm run lint
```

## Source Layout

```text
src/
  server.js
  config/
  controllers/
  middleware/
  providers/
  repositories/
  routes/
```

## Server Entry Point

The Express app is created in:

```text
src/server.js
```

This file is responsible for:

- loading environment variables
- configuring CORS
- enabling cookies and JSON parsing
- registering route modules
- adding the health check
- starting the server

Important routes currently mounted:

```text
/auth
/categories
/items
/activity
/api/barcode
/api/inventory
```

## Database Config

PostgreSQL configuration lives in:

```text
src/config/database.js
```

It exports `pgPool`, which is used by controllers and repositories. The database connection comes from:

```text
DATABASE_URL
```

Do not commit real database credentials.

## Routes and Controllers

Routes are thin files that connect HTTP paths to controller functions:

```text
src/routes/
```

Controllers contain request/response logic:

```text
src/controllers/
```

Important controllers:

- `authController.js`
- `barcodeController.js`
- `categories.js`
- `itemController.js`
- `batchController.js`
- `inventoryController.js`
- `activityController.js`

## Repositories

Repository files contain reusable database operations:

```text
src/repositories/
```

Important repositories:

- `inventoryRepository.js`: category/item inventory detail and check-in logic
- `barcodeRepository.js`: barcode lookup mappings
- `userRepository.js`: user persistence

## SQL Folder

Database setup and migrations live in:

```text
sql/
```

Important files:

- `create_tables.sql`: baseline PostgreSQL setup for fresh environments
- `migrate_v2.sql`: item/batch restructuring and original seed data
- `migrate_v3.sql`: activity log table
- `migrate_v4.sql`: multiple barcodes per item
- `migrate_v5_reset_inventory_categories.sql`: inventory reset and current category taxonomy

Migrations are currently manual SQL files. Keep them ordered, explicit, and safe to run in the intended environment.
