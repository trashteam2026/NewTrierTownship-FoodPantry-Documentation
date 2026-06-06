---
id: architecture
title: Architecture & Core Logic
sidebar_position: 2
---

# Architecture & Core Logic

This page lists every HTTP endpoint and describes the core request flows. It pairs with three other pages. For where each file lives and how the app is wired, see [Project Structure](./project-structure). For tables, columns, indexes, and constraints, see [Database Schema](../database-schema). For how tokens and owner gating work, see [Authentication](../authentication).

The app is an Express router tree. `app.js` mounts seven routers under prefixes and defines `GET /health` inline. The prefixes are `/auth`, `/categories`, `/items`, `/activity`, `/api/barcode`, `/api/inventory`, and `/api/volunteer`. A small middleware collapses repeated slashes in `req.url` before routing.

## Endpoint table

The Middleware column shows the chain in order. `none` means the handler runs with no auth middleware. `authMiddleware` verifies a Firebase ID token and sets `req.user`. `requireOwner` runs after `authMiddleware` and rejects non-owners. `optionalAuth` sets `req.user` if a valid token is present and continues either way.

| Method + Path | Middleware | Handler | Notes |
| --- | --- | --- | --- |
| `POST /auth/signup` | none | `authController.signup` | Creates a Firebase user, then a DB user. |
| `GET /auth/profile` | none | `authController.getMe` | Reads token from the `session` cookie or `Authorization` header. |
| `GET /auth/users` | authMiddleware + requireOwner | `authController.getAllUsers` | Owner-only list of users. |
| `POST /auth/token` | none | `authController.handleToken` | Syncs an OAuth user into the DB and sets a session cookie. |
| `GET /categories` | authMiddleware + requireOwner | `categoriesController.getAllCategories` | Owner-only. |
| `GET /categories/:id` | authMiddleware + requireOwner | `categoriesController.getCategoryById` | Owner-only. |
| `POST /categories` | authMiddleware + requireOwner | `categoriesController.createCategory` | Owner-only. |
| `PUT /categories/:id` | authMiddleware + requireOwner | `categoriesController.updateCategory` | Owner-only. Updates name only. |
| `DELETE /categories/:id` | authMiddleware + requireOwner | `categoriesController.deleteCategory` | Owner-only. Deletes items in the category in one transaction. |
| `GET /items` | authMiddleware + requireOwner | `itemController.getAllItems` | Owner-only. |
| `GET /items/:id` | authMiddleware + requireOwner | `itemController.getItemById` | Owner-only. Returns item with batches and barcodes. |
| `POST /items` | authMiddleware + requireOwner | `itemController.createItem` | Owner-only. |
| `PUT /items/:id` | authMiddleware + requireOwner | `itemController.updateItem` | Owner-only. Partial update. |
| `DELETE /items/:id` | authMiddleware + requireOwner | `itemController.deleteItem` | Owner-only. |
| `POST /items/:itemId/batches` | authMiddleware + requireOwner | `batchController.createBatch` | Owner-only. |
| `PUT /items/:itemId/batches/:batchId` | authMiddleware + requireOwner | `batchController.updateBatch` | Owner-only. Logs the quantity delta. |
| `DELETE /items/:itemId/batches/:batchId` | authMiddleware + requireOwner | `batchController.deleteBatch` | Owner-only. Logs a `removed` row. |
| `GET /activity` | authMiddleware + requireOwner | `activityController.getLogs` | Owner-only. Date-range filtered. |
| `PATCH /activity/:id` | authMiddleware | `activityController.updateLog` | Self-only guard inside the handler. |
| `DELETE /activity/:id` | authMiddleware | `activityController.deleteLog` | Self-only guard inside the handler. |
| `POST /api/barcode/lookup` | none | `lookupBarcode` | DB, then custom mapping, then external providers. |
| `POST /api/barcode/generate` | authMiddleware + requireOwner | `generateBarcode` | Owner-only. Generates a local UPC-A. |
| `GET /api/inventory/categories` | authMiddleware | `inventoryController.listCategories` | Token-only. Anonymous volunteers pass. |
| `POST /api/inventory/check-in` | optionalAuth | `inventoryController.checkIn` | 3-case guard inside the handler. |
| `POST /api/inventory/check-out` | authMiddleware + requireOwner | `inventoryController.checkOut` | Owner-only. |
| `GET /api/volunteer/session` | authMiddleware + requireOwner | `getSession` | Owner-only. |
| `POST /api/volunteer/session` | authMiddleware + requireOwner | `generateSession` | Owner-only. Generate or regenerate code. |
| `DELETE /api/volunteer/session` | authMiddleware + requireOwner | `endSession` | Owner-only. Ends the session. |
| `POST /api/volunteer/verify` | none | `verifyCode` | Checks a code against live sessions. |
| `POST /api/volunteer/register` | authMiddleware | `registerVolunteer` | Any authenticated user, including anonymous. |
| `GET /api/volunteer/me` | authMiddleware | `getMyProfile` | Volunteer profile for the scan-in header. |
| `DELETE /api/volunteer/me` | authMiddleware | `finishVolunteering` | Removes the volunteer's `active_volunteers` row. |
| `GET /api/volunteer/volunteers` | authMiddleware + requireOwner | `getActiveVolunteers` | Owner-only. |
| `GET /api/volunteer/history` | authMiddleware + requireOwner | `getVolunteerHistory` | Owner-only. |
| `GET /health` | none | inline in `app.js` | Returns `{ status: 'ok' }` with 200. |

## Auth and gating recap

For full detail see [Authentication](../authentication). Three pieces gate the routes.

`authMiddleware` reads the `Authorization: Bearer <token>` header and calls `admin.auth().verifyIdToken`. On success it sets `req.user` to the decoded token and calls `next()`. On a missing or bad token it returns 401.

`requireOwner` runs after `authMiddleware`. It calls `isOwner(req.user)`. An owner is a non-anonymous user whose email is in the `owners` table. Anonymous volunteers are never owners. A non-owner gets 403 `Owner access required`.

`optionalAuth` is used by check-in. It sets `req.user` if a valid token is present and continues without `req.user` if the token is missing or invalid.

Check-in does its own gating in three cases, taken from `inventoryController.checkIn`:

- **NO_TOKEN** (403 `Authentication required`): `req.user` is not set. `optionalAuth` saw no usable token.
- **SESSION_ENDED** (403 `Volunteer session has ended`): `req.user.firebase?.sign_in_provider === 'anonymous'` and `isVolunteerSessionActive(req.user.uid)` returns false.
- **NOT_OWNER** (403 `Owner access required`): the user is not anonymous and `isOwner(req.user)` returns false.

## Core flows

### Check-in

`inventoryRepository.checkInInventoryItem` runs the item, barcode, and batch writes in one transaction. The controller normalizes input first. `quantity` defaults to 1 and must be a positive integer. `categoryId` and `lowStockThreshold` are optional positive integers. `expirationDate` is parsed and sliced to `YYYY-MM-DD` so same-day check-ins land on one batch row.

Inside the transaction:

1. Resolve the item. The upsert targets the identity index.

   ```sql
   INSERT INTO items (name, category_id, low_stock_threshold)
   VALUES ($1, $2, $3)
   ON CONFLICT (LOWER(TRIM(name)), COALESCE(category_id, -1)) DO UPDATE SET
     name = items.name
   RETURNING id, barcode, name, category_id, low_stock_threshold;
   ```

   The conflict path sets `name = items.name`. This is a no-op touch. It returns the existing row and does not overwrite the stored name, category, or threshold. Check-in never renames or recategorizes an item.

2. If a barcode is given, look up an existing item by barcode first. If none is found, resolve the item with the upsert above, then attach the barcode.

   ```sql
   INSERT INTO item_barcodes (item_id, barcode)
   VALUES ($1, $2)
   ON CONFLICT (barcode) DO NOTHING;
   ```

   `DO NOTHING` turns a same-barcode race into a no-op instead of a unique-violation 500.

3. Merge the batch.

   ```sql
   INSERT INTO item_batches (item_id, expiration_date, quantity)
   VALUES ($1, $2, $3)
   ON CONFLICT (item_id, expiration_date) DO UPDATE SET
     quantity = item_batches.quantity + EXCLUDED.quantity
   RETURNING id, item_id, expiration_date, quantity;
   ```

   A repeat check-in for the same item and date adds to the existing batch. A `NULL` expiration date does not merge, so each no-date check-in makes a new batch row. See [Gotchas](../gotchas).

After `COMMIT`, the activity log is written outside the transaction. It tries a full insert with `volunteer_name`, `volunteer_uid`, and `batch_id`. If that fails, it falls back to a minimal insert with just item, action, and quantity. If both fail, the error is logged and the check-in still stands. A logging failure does not roll back the check-in.

Also after commit, the controller increments the volunteer counter only for anonymous users. The call to `incrementItemsScanned` runs in a try/catch, so a counter error cannot roll back a successful check-in. For owners this step is skipped.

On success the handler returns 201 with `message`, the full item detail, the batch, and `activityLogId`.

### Scan-out / check-out

`inventoryRepository.checkOutInventoryItem` runs in one transaction. The controller requires a positive integer `quantity` and either a `barcode` or an `itemId`.

1. Resolve the item. With `itemId`, select from `items` by id. Without it, join `item_barcodes` on the barcode. A missing item by id throws `ITEM_NOT_FOUND`. A missing item by barcode throws `BARCODE_NOT_FOUND` with the barcode attached.

2. Lock the batches in FEFO order.

   ```sql
   SELECT id, expiration_date, quantity
     FROM item_batches
    WHERE item_id = $1
    ORDER BY expiration_date ASC NULLS LAST, id ASC
    FOR UPDATE;
   ```

   `FOR UPDATE` holds the rows so a concurrent checkout cannot read the same stock and double-decrement it.

3. Sum the locked quantities. If the total is less than `quantity`, throw `INSUFFICIENT_STOCK` with `requested` and `available`.

4. Decrement earliest first. For each batch, take `min(batchQty, remaining)`. A batch driven to 0 is deleted. A batch above 0 is updated. Each affected batch is recorded in `batchesAffected`.

5. Write the activity row inside the transaction.

   ```sql
   INSERT INTO activity_log (item_id, item_name, action, quantity)
   VALUES ($1, $2, 'removed', $3);
   ```

Then `COMMIT`. The controller maps the thrown errors: 404 `BARCODE_NOT_FOUND`, 404 `ITEM_NOT_FOUND`, and 409 `INSUFFICIENT_STOCK` with `requested` and `available`. On success it returns 200 with the item detail, `removed`, and `batchesAffected`.

### Activity edit and delete

`activityController.updateLog` and `deleteLog` both run under `authMiddleware` only. They enforce two gates before touching data.

First, `ensureActiveVolunteerSession` runs. For a non-anonymous user it passes. For an anonymous user it requires a live session, else 403 `Volunteer session has ended` with code `SESSION_ENDED`.

Second, inside the transaction, the row is loaded `FOR UPDATE` with `action = 'added'`. If the row's `volunteer_uid` is not equal to `req.user.uid`, the handler rolls back and returns 403 `Forbidden`. This is the self-only guard.

`updateLog` computes `delta = newQty - log.quantity`. If `delta` is non-zero it locks the linked batch and applies the delta. A new batch quantity of 0 deletes the batch. Above 0 it updates. Then it updates the log row's quantity and commits.

`deleteLog` adjusts the linked batch by subtracting the log's quantity, then deletes the log row. In the same transaction it decrements the volunteer counter, floored at 0.

```sql
UPDATE active_volunteers
   SET items_scanned = GREATEST(items_scanned - 1, 0)
 WHERE volunteer_uid = $1;
```

The 409 conditions:

- `updateLog`, no batch reference: `log.batch_id` is null. Returns `Cannot edit — no batch reference available`.
- `updateLog`, batch gone: the batch id no longer exists. Returns `Cannot edit — the batch no longer exists`.
- `updateLog`, would go negative: `batchQty + delta < 0`. Returns `Cannot reduce quantity — items may have already been checked out` with code `INSUFFICIENT_STOCK`.
- `deleteLog`, no batch reference: `log.batch_id` is null. Returns `Cannot delete — no batch reference available`.
- `deleteLog`, would go negative: `batchQty - log.quantity < 0`. Returns `Cannot delete — items may have already been checked out` with code `INSUFFICIENT_STOCK`.

In `deleteLog`, if the batch row is already gone the batch step is skipped and the log row is still deleted.

### Volunteer sessions

`volunteerController` manages codes and sessions. The code alphabet is `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. A code is 8 characters, built from 8 random bytes mapped through the alphabet. The session duration is 8 hours (`SESSION_DURATION_MS = 8 * 60 * 60 * 1000`).

`generateSession` upserts on `owner_uid`.

```sql
INSERT INTO volunteer_sessions (owner_uid, code, created_at, expires_at)
VALUES ($1, $2, NOW(), NOW() + ($3::int * INTERVAL '1 millisecond'))
ON CONFLICT (owner_uid) DO UPDATE SET
  code = EXCLUDED.code,
  created_at = EXCLUDED.created_at,
  expires_at = EXCLUDED.expires_at
RETURNING code, created_at AS "createdAt", expires_at AS "expiresAt";
```

This replaces the row in place. The owner gets a new code, a new `created_at`, and a new `expires_at`. On a `code` unique collision (23505) it retries up to five times, then returns 500 `Could not generate a unique code, please try again`.

`endSession` runs in a transaction. It reads the owner's code, deletes `active_volunteers` rows for that code, then expires the session.

```sql
UPDATE volunteer_sessions
   SET expires_at = LEAST(expires_at, NOW())
 WHERE owner_uid = $1;
```

`getVolunteerHistory` anchors its cutoff to the session `created_at`. A CTE reads the owner's session `created_at` and the query keeps `activity_log` rows where `created_at >= cs.created_at`, `action = 'added'`, and `volunteer_uid IS NOT NULL`. The CTE does not filter on expiry, so history is bound to the current session row's start time.

End Session and Generate New Code differ. End Session evicts `active_volunteers` for the code and sets `expires_at` to now, so the code stops working. Generate New Code replaces the session row in place. The old code disappears from `volunteer_sessions`, so any volunteer still holding the old code no longer matches a live session, while `endSession` is what explicitly removes the `active_volunteers` rows. See [Gotchas](../gotchas).

## Error reference

Status, message, and condition for each handler. The `code` field is shown where the response sets one. Error messages are quoted from the code.

### authMiddleware and requireOwner

| Status | Message | Condition |
| --- | --- | --- |
| 401 | `No Firebase ID token provided` | No Bearer token. |
| 401 | `Firebase ID token expired` | `auth/id-token-expired`. |
| 401 | `Invalid Firebase ID token` | `auth/invalid-id-token`. |
| 500 | `Internal server error during authentication` | Other verify error. |
| 403 | `Owner access required` | `requireOwner` and not an owner. |

### auth (authController)

| Status | Message | Condition |
| --- | --- | --- |
| 400 | `Email, password, and username are required` | Missing field in signup. |
| 400 | `Email already in use` | `auth/email-already-exists`. |
| 400 | `Username already exists` | Duplicate key on signup (23505). |
| 401 | `Not authenticated` | `getMe` with no token. |
| 401 | `Authentication failed` | `getMe` token verify error. |
| 400 | `No ID token provided` | `handleToken` with no `idToken`. |
| 400 | `Username already exists, please choose another` | `handleToken` duplicate username. |
| 400 | `Email already exists for another account` | `handleToken` duplicate email. |
| 500 | `Internal server error` | Unhandled error. |

### inventory check-in

| Status | Message | Code | Condition |
| --- | --- | --- | --- |
| 403 | `Authentication required` | `NO_TOKEN` | No `req.user`. |
| 403 | `Volunteer session has ended` | `SESSION_ENDED` | Anonymous with no live session. |
| 403 | `Owner access required` | `NOT_OWNER` | Non-anonymous and not owner. |
| 400 | `name is required` | | Missing name. |
| 400 | `quantity must be a positive integer` | | Bad quantity. |
| 400 | `categoryId must be a positive integer` | | Bad categoryId. |
| 400 | `lowStockThreshold must be a positive integer` | | Bad threshold. |
| 400 | `expirationDate must be a valid date` | | Unparseable date. |
| 400 | `categoryId does not exist` | | FK violation (23503). |
| 500 | `Internal server error` | | Unhandled error. |

### inventory check-out

| Status | Message | Code | Condition |
| --- | --- | --- | --- |
| 400 | `quantity must be a positive integer` | | Bad quantity. |
| 400 | `itemId must be a positive integer` | | Bad itemId. |
| 400 | `barcode or itemId is required` | | Neither provided. |
| 404 | `No item is registered for this barcode` | `BARCODE_NOT_FOUND` | Barcode maps to no item. Includes `barcode`. |
| 404 | `Item not found` | `ITEM_NOT_FOUND` | itemId maps to no item. |
| 409 | `Insufficient stock for the requested quantity` | `INSUFFICIENT_STOCK` | Available less than requested. Includes `requested` and `available`. |
| 500 | `Internal server error` | | Unhandled error. |

`inventoryController.listCategories` returns 500 `Internal server error` on failure.

### items (itemController)

| Status | Message | Condition |
| --- | --- | --- |
| 400 | `Invalid item id` | Non-positive or non-integer id. |
| 400 | `Item name is required` | Create with no name. |
| 400 | `Item name cannot be empty` | Update with empty name. |
| 400 | `No fields to update` | Update with no fields. |
| 404 | `Item not found` | Id not found on get, update, or delete. |
| 500 | `Internal server error` | Unhandled error. |

### batches (batchController)

| Status | Message | Condition |
| --- | --- | --- |
| 400 | `Invalid item id` | Bad itemId on create. |
| 400 | `Invalid id` | Bad itemId or batchId on update or delete. |
| 400 | `Quantity must be a non-negative number` | Bad quantity. |
| 400 | `No fields to update` | Update with no fields. |
| 404 | `Item not found` | Item missing on create. |
| 404 | `Batch not found` | Batch missing on update or delete. |
| 500 | `Internal server error` | Unhandled error. |

### categories (categories.js)

| Status | Message | Condition |
| --- | --- | --- |
| 400 | `Invalid category id` | Bad id. |
| 400 | `Category name is required` | Missing name on create or update. |
| 400 | `parent_group must be food or non_food` | Bad parent group on create. |
| 404 | `Category not found` | Id not found on get, update, or delete. |
| 409 | `Category name already exists` | Duplicate name (23505). |
| 409 | `Cannot delete category with related items` | FK violation on delete (23503). |
| 500 | `Internal server error` | Unhandled error. |

### activity (activityController)

| Status | Message | Code | Condition |
| --- | --- | --- | --- |
| 400 | `Invalid log id` | | Non-positive or non-integer id. |
| 400 | `quantity must be a positive integer` | | Bad quantity on update. |
| 403 | `Volunteer session has ended` | `SESSION_ENDED` | Anonymous with no live session. |
| 404 | `Log entry not found` | | No matching `added` row. |
| 403 | `Forbidden` | | `volunteer_uid` not equal to caller uid. |
| 409 | `Cannot edit — no batch reference available` | | Update with null `batch_id`. |
| 409 | `Cannot edit — the batch no longer exists` | | Update and the batch is gone. |
| 409 | `Cannot reduce quantity — items may have already been checked out` | `INSUFFICIENT_STOCK` | Update would drive the batch below 0. |
| 409 | `Cannot delete — no batch reference available` | | Delete with null `batch_id`. |
| 409 | `Cannot delete — items may have already been checked out` | `INSUFFICIENT_STOCK` | Delete would drive the batch below 0. |
| 500 | `Internal server error` | | Unhandled error. |

### barcode (barcodeController)

| Status | Message | Condition |
| --- | --- | --- |
| 400 | `Barcode is required` | Lookup with no barcode. |
| 404 | `Product not found` | No DB, custom, or external match. |
| 503 | `Barcode provider rate limit hit` | Provider returned 429. |
| 400 | `name and categoryId are required` | Generate with bad input. |
| 400 | `categoryId does not exist` | `CATEGORY_NOT_FOUND` on generate. |
| 409 | `Could not generate an unused barcode. Please try again.` | No free code after 25 attempts. |
| 500 | `Internal server error` | Unhandled error. |

### volunteer (volunteerController)

| Status | Message | Code | Condition |
| --- | --- | --- | --- |
| 400 | `Code is required` | | `verifyCode` with no code. Body also sets `valid: false`. |
| 401 | `Invalid or expired code` | | `verifyCode` with no live match. Body also sets `valid: false`. |
| 400 | `name is required` | | `registerVolunteer` with no name. |
| 400 | `code is required` | | `registerVolunteer` with no code. |
| 401 | `Invalid or expired code` | `INVALID_CODE` | `registerVolunteer` with no live session. |
| 404 | `No active volunteer session` | | `getMyProfile` with no `active_volunteers` row. |
| 403 | `Volunteer session has ended` | `SESSION_ENDED` | `getMyProfile` and the session is gone. The row is then deleted. |
| 500 | `Could not generate a unique code, please try again` | | `generateSession` after five code collisions. |
| 500 | `Internal server error` | | Unhandled error. `verifyCode` also sets `valid: false`. |

## Timezone note

Activity date-range filtering uses `America/Chicago` (`ACTIVITY_TIME_ZONE` in `activityController`). The `start` and `end` query params are dates. They are converted to timestamps at that zone before comparing against `created_at`. Storage is `TIMESTAMPTZ`, held in UTC. The zone conversion happens at query time, not at write time.
