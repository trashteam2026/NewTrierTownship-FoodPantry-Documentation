---
id: gotchas
title: Known Behaviors
sidebar_position: 7
---

# Known Behaviors

This page lists behaviors that are correct and intended in the code but are not obvious from the outside. A new developer could read these as bugs. They are not. Each entry says what happens, why, and where the code lives.

## No-expiration batches do not merge

A dated check-in for the same item and same day merges into one batch row. A check-in with no expiration date adds a new batch row every time.

Stock lives in `item_batches`, which has a unique index on `(item_id, expiration_date)`. Check-in inserts a batch with `ON CONFLICT (item_id, expiration_date) DO UPDATE SET quantity = item_batches.quantity + EXCLUDED.quantity`. Postgres treats two `NULL` values as distinct in a unique index, so two no-date rows never conflict and never merge. Dated rows do conflict, so they merge. Check-in also stores the date as `YYYY-MM-DD`, which keeps same-day dated check-ins on one row.

The index is in `sql/schema.sql`. The upsert is in `src/repositories/inventoryRepository.js`.

## Item delete is not written to activity_log

Deleting a category logs a `removed` row per item that had stock. Deleting a batch logs a `removed` row. Deleting an item logs nothing.

`deleteItem` runs `DELETE FROM items` and returns. It makes no `activity_log` write. `deleteCategory` loops the category's items and inserts a `removed` row for each one with quantity above zero. `deleteBatch` inserts a `removed` row for the batch quantity.

`deleteItem` is in `src/controllers/itemController.js`. `deleteCategory` is in `src/controllers/categories.js`. `deleteBatch` is in `src/controllers/batchController.js`.

## Multi-line scan-out is not atomic

A cart with many lines is not checked out in one transaction. Each line is its own request.

`ScanOutPage` loops the cart and calls `checkoutApi.checkOut` once per line. The backend runs each check-out in its own transaction. A failure partway through the list leaves the earlier lines committed. Most per-line errors mark that line and let the loop continue. Only a `401` or `403` sets `aborted` and breaks the loop.

The loop is in `src/pages/scan-out/ScanOutPage.jsx`. The per-line transaction is `checkOutInventoryItem` in `src/repositories/inventoryRepository.js`.

## Check-in does not update item attributes

A check-in for an item that already exists does not change its category or its low-stock threshold, even when the request sends different values.

The match-or-create upsert is `ON CONFLICT (LOWER(TRIM(name)), COALESCE(category_id, -1)) DO UPDATE SET name = items.name`. Setting `name = items.name` is a no-op touch. It returns the existing row without writing the incoming name, category, or threshold. The new values reach the batch insert, not the item row.

This is in `checkInInventoryItem` in `src/repositories/inventoryRepository.js`.

## Public barcode lookup

`POST /api/barcode/lookup` has no auth. Anyone can post a barcode and read back the matching item name and category.

The route is registered as `router.post('/lookup', lookupBarcode)` with no middleware. The sibling route `POST /api/barcode/generate` runs `authMiddleware` then `requireOwner`. Only lookup is open.

The routes are in `src/routes/barcodeRoutes.js`. The handler is in `src/controllers/barcodeController.js`.

## OWNER_EMAILS is not read

No code reads `process.env.OWNER_EMAILS`. Owner authority comes from the `owners` table.

`isOwner` calls `isOwnerEmail`, which calls the user repository, which queries `SELECT 1 FROM owners WHERE email = LOWER(TRIM($1))`. The function entry point in `index.js` still lists `OWNER_EMAILS` in its `secrets` array, so the secret is injected at runtime, but no code reads it.

The owner check is in `src/middleware/authMiddleware.js` and `src/providers/postgresProvider.js`. The secrets list is in `index.js`. See [Authentication](./authentication).

## Generate New Code strands the current volunteers

When an owner presses Generate New Code, volunteers who joined with the old code stop matching a live session.

`generateSession` upserts `volunteer_sessions` with `ON CONFLICT (owner_uid) DO UPDATE SET code = EXCLUDED.code, created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at`. There is one session row per owner, so the new code replaces the old code in place and resets `created_at`. A volunteer's `active_volunteers` row still holds the old code, and the session check joins on `code`, so that volunteer no longer matches a live session. The volunteer history window starts at the session's `created_at`, so it resets too. End Session is the path that deletes `active_volunteers` rows.

This is in `src/controllers/volunteerController.js`. See [Architecture & Core Logic](./backend/architecture).

## getMyProfile self-heals

A volunteer row that no longer maps to a live session is removed when it is next read.

`getMyProfile` reads the volunteer's `active_volunteers` row, then checks the row's code against a live `volunteer_sessions` row. If there is no live session, it deletes the `active_volunteers` row and returns `403` with code `SESSION_ENDED`. `getActiveVolunteers`, the owner view, deletes orphaned `active_volunteers` rows on each call before it lists them.

Both are in `src/controllers/volunteerController.js`.

## Most controllers query pgPool directly

Only the inventory, barcode, and user paths go through a repository. The item, batch, category, activity, and volunteer controllers import `pgPool` and run SQL on the pool.

`inventoryController` uses `inventoryRepository`. `barcodeController` uses `barcodeRepository`. The auth path uses `userRepository`. The other controllers hold their SQL inline.

The controllers are in `src/controllers/`. The repositories are in `src/repositories/`. See [Project Structure](./backend/project-structure).

## postgresProvider vs mysqlProvider

`userRepository` imports `postgresProvider`. The `mysqlProvider` import sits next to it, commented out.

`postgresProvider` holds the live user and owner SQL and runs it on `pgPool`. `mysqlProvider` is the MySQL alternate. It is not imported anywhere active.

`userRepository` is in `src/repositories/userRepository.js`. The providers are in `src/providers/`.

## Activity cap and history cap

`GET /activity` returns at most 5000 rows. The volunteer history endpoint returns at most 500 rows and sets a `truncated` flag.

`getLogs` ends its query with `LIMIT 5000`. `getVolunteerHistory` reads `VOLUNTEER_HISTORY_LIMIT + 1` rows, returns the first 500, and sets `truncated` to true when more than 500 came back.

`getLogs` is in `src/controllers/activityController.js`. `getVolunteerHistory` is in `src/controllers/volunteerController.js`.

## Firebase config can be undefined on a local build

A local `vite build` with no Firebase environment variables produces a bundle where the Firebase config values are `undefined`.

`firebase-config.js` reads the seven `VITE_FIREBASE_*` variables from `import.meta.env`. Vite inlines these at build time. When the variables are not set, each one inlines as `undefined`.

This is in `src/firebase-config.js`. See [Deployment](./frontend/deployment).

## Schema and the older SQL files differ

`sql/schema.sql` is the canonical file for a fresh deploy. The older `create_tables.sql` and migration files differ from it in spots.

In `create_tables.sql` the `categories.parent_group` column has no default and `display_order` defaults to `1`. In `schema.sql` `parent_group` defaults to `'food'` and `display_order` defaults to `0`. Migration `004_items_category_on_delete_cascade.sql` flips the `items.category_id` foreign key from `ON DELETE SET NULL` to `ON DELETE CASCADE`. `schema.sql` writes the `CASCADE` value directly.

The files are `sql/schema.sql`, `sql/create_tables.sql`, and `migrations/004_items_category_on_delete_cascade.sql`.

## Activity date filter uses Central time

The activity date-range filter reads dates in `America/Chicago`. The stored timestamps are UTC.

`activityController` converts the `start` and `end` query dates with `AT TIME ZONE 'America/Chicago'`. `activity_log.created_at` is `TIMESTAMPTZ`, stored in UTC. A row written near midnight can fall on one calendar day in Central time and a different day under a naive UTC read.

The filter is in `src/controllers/activityController.js`. The column type is in `sql/schema.sql`.
