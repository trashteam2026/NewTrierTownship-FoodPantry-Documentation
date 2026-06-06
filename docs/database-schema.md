---
id: database-schema
title: Database Schema
sidebar_position: 6
---

# Database Schema

The canonical schema is `sql/schema.sql` in the backend. It is one file for a fresh database. Run it once against an empty Postgres database and it reproduces the live schema. The database runs on Postgres on Supabase.

Every statement is idempotent. Tables use `CREATE TABLE IF NOT EXISTS`, indexes use `CREATE ... INDEX IF NOT EXISTS`, and seed inserts use `ON CONFLICT DO NOTHING` or a `WHERE NOT EXISTS` guard. Re-running the file is safe. The file folds in the older `sql/*.sql` and `migrations/*` files, which stay in the repo for history but are no longer required.

See [Getting Started](./getting-started) for how to apply this file.

The sections below follow the order of `sql/schema.sql`.

## users

App user accounts, keyed to Firebase Auth.

| Column | Type | Constraints / Defaults |
| --- | --- | --- |
| `id` | `SERIAL` | `PRIMARY KEY` |
| `firebase_uid` | `VARCHAR(128)` | `NOT NULL`, `UNIQUE` |
| `username` | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` |
| `email` | `VARCHAR(255)` | `NOT NULL`, `UNIQUE` |
| `firstname` | `VARCHAR(100)` | `DEFAULT NULL` |
| `lastname` | `VARCHAR(100)` | `DEFAULT NULL` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |

Foreign keys: none.

Indexes: the primary key on `id`, plus the unique constraints on `firebase_uid`, `username`, and `email`.

## barcode_mappings

Maps a barcode to a custom display name.

| Column | Type | Constraints / Defaults |
| --- | --- | --- |
| `id` | `SERIAL` | `PRIMARY KEY` |
| `barcode` | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` |
| `custom_name` | `VARCHAR(255)` | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |

Foreign keys: none.

Indexes: the primary key on `id`, plus the unique constraint on `barcode`.

## categories

Item categories, split into a food group and a non-food group.

| Column | Type | Constraints / Defaults |
| --- | --- | --- |
| `id` | `SERIAL` | `PRIMARY KEY` |
| `name` | `TEXT` | `NOT NULL` |
| `parent_group` | `TEXT` | `NOT NULL DEFAULT 'food'`, `CHECK (parent_group IN ('food', 'non_food'))` |
| `display_order` | `INTEGER` | `NOT NULL DEFAULT 0` |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` |

`parent_group` is held to two values by the check: `'food'` or `'non_food'`.

Foreign keys: none.

Indexes: the primary key on `id`, plus a case-insensitive unique index on the name:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name
  ON categories (LOWER(name));
```

This blocks two categories whose names differ only in case.

## items

The item catalog. One row per distinct product.

| Column | Type | Constraints / Defaults |
| --- | --- | --- |
| `id` | `SERIAL` | `PRIMARY KEY` |
| `name` | `TEXT` | `NOT NULL` |
| `category_id` | `INTEGER` | `REFERENCES categories(id) ON DELETE CASCADE` |
| `low_stock_threshold` | `INTEGER` | `NOT NULL DEFAULT 20` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` |
| `barcode` | `VARCHAR(50)` | legacy column, added by `ALTER TABLE` |

Foreign keys:

- `category_id` references `categories(id)` `ON DELETE CASCADE`. Deleting a category deletes its items.

Indexes:

The legacy `barcode` column carries a partial unique index. `item_barcodes` supersedes it, but both the column and the index remain in the live schema.

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_barcode
  ON items (barcode)
  WHERE barcode IS NOT NULL;
```

The item identity index sets one item per normalized name and category:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_identity
  ON items (LOWER(TRIM(name)), COALESCE(category_id, -1));
```

`idx_items_identity` is the `ON CONFLICT` target for check-in. The name is lowercased and trimmed. A `NULL` category collapses to `-1`, a sentinel that can never be a real id, so all uncategorized rows share one bucket. Check-in runs as a conflict-safe upsert, so two same-product check-ins at once resolve to one row instead of two duplicate catalog rows.

## item_batches

Stock for an item, split by expiration date. Each batch holds a quantity.

| Column | Type | Constraints / Defaults |
| --- | --- | --- |
| `id` | `SERIAL` | `PRIMARY KEY` |
| `item_id` | `INTEGER` | `NOT NULL`, `REFERENCES items(id) ON DELETE CASCADE` |
| `expiration_date` | `DATE` | nullable |
| `quantity` | `INTEGER` | `NOT NULL DEFAULT 1`, `CHECK (quantity >= 0)` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` |

Foreign keys:

- `item_id` references `items(id)` `ON DELETE CASCADE`. Deleting an item deletes its batches.

Indexes:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_batches_item_expiration
  ON item_batches (item_id, expiration_date);
```

`idx_item_batches_item_expiration` is the batch-merge `ON CONFLICT` target. A new check-in for the same item and the same expiration date merges into the existing batch instead of adding a row.

Postgres treats two `NULL` values as distinct in a unique index. So batches with no expiration date do not merge. Each no-expiration check-in for an item adds a new batch row. See [Gotchas](./gotchas).

## item_barcodes

Barcodes for an item. One item can have many barcodes.

| Column | Type | Constraints / Defaults |
| --- | --- | --- |
| `id` | `SERIAL` | `PRIMARY KEY` |
| `item_id` | `INTEGER` | `NOT NULL`, `REFERENCES items(id) ON DELETE CASCADE` |
| `barcode` | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` |

This table supersedes the legacy `items.barcode` column. The schema backfills any legacy values into it with an `ON CONFLICT (barcode) DO NOTHING` insert, which is a no-op on a fresh database.

Foreign keys:

- `item_id` references `items(id)` `ON DELETE CASCADE`. Deleting an item deletes its barcodes.

Indexes: the primary key on `id`, the unique constraint on `barcode`, and a lookup index on `item_id`:

```sql
CREATE INDEX IF NOT EXISTS idx_item_barcodes_item_id
  ON item_barcodes (item_id);
```

## activity_log

A record of every add and remove. Drives the activity views and volunteer history.

| Column | Type | Constraints / Defaults |
| --- | --- | --- |
| `id` | `SERIAL` | `PRIMARY KEY` |
| `item_id` | `INTEGER` | `REFERENCES items(id) ON DELETE SET NULL` |
| `item_name` | `TEXT` | `NOT NULL` |
| `action` | `TEXT` | `NOT NULL`, `CHECK (action IN ('added', 'removed'))` |
| `quantity` | `INTEGER` | `NOT NULL`, `CHECK (quantity > 0)` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |
| `volunteer_name` | `TEXT` | nullable |
| `volunteer_uid` | `TEXT` | nullable |
| `batch_id` | `INTEGER` | `REFERENCES item_batches(id) ON DELETE SET NULL` |

`action` is held to `'added'` or `'removed'` by the check. `quantity` must be greater than zero.

The log keeps `item_name` as its own column. So a log row still reads with a name after its item or batch is gone.

Foreign keys:

- `item_id` references `items(id)` `ON DELETE SET NULL`. Deleting an item leaves the log row and sets `item_id` to `NULL`.
- `batch_id` references `item_batches(id)` `ON DELETE SET NULL`. Deleting a batch leaves the log row and sets `batch_id` to `NULL`.

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
  ON activity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_item_id
  ON activity_log (item_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_batch_id
  ON activity_log (batch_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_added_created_at
  ON activity_log (created_at DESC)
  WHERE action = 'added';
```

`idx_activity_log_item_id` and `idx_activity_log_batch_id` back the two `ON DELETE SET NULL` foreign keys, so an item or batch delete does not run a full table scan. `idx_activity_log_added_created_at` is a partial index that covers only `action = 'added'` rows. It serves the volunteer-history query, which reads added rows in a date range ordered by `created_at DESC`.

## volunteer_sessions

One live volunteer session per owner. The session holds the access code.

| Column | Type | Constraints / Defaults |
| --- | --- | --- |
| `owner_uid` | `TEXT` | `PRIMARY KEY` |
| `code` | `TEXT` | `NOT NULL`, `UNIQUE` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` |

The table is keyed by `owner_uid`, so each owner has at most one session row.

Foreign keys: none.

Indexes: the primary key on `owner_uid`, the unique constraint on `code`, and an index on `expires_at`:

```sql
CREATE INDEX IF NOT EXISTS idx_volunteer_sessions_expires_at
  ON volunteer_sessions (expires_at);
```

## active_volunteers

One row per anonymous volunteer who joined a session.

| Column | Type | Constraints / Defaults |
| --- | --- | --- |
| `volunteer_uid` | `TEXT` | `PRIMARY KEY` |
| `name` | `TEXT` | `NOT NULL` |
| `code` | `TEXT` | `NOT NULL` |
| `joined_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |
| `items_scanned` | `INTEGER` | `NOT NULL DEFAULT 0` |

`code` is the session code the volunteer joined with. It is not a foreign key to `volunteer_sessions`.

Foreign keys: none.

Indexes: the primary key on `volunteer_uid`, plus a lookup index on `code`:

```sql
CREATE INDEX IF NOT EXISTS idx_active_volunteers_code
  ON active_volunteers (code);
```

## owners

The owner allowlist. It holds the emails that grant owner access.

| Column | Type | Constraints / Defaults |
| --- | --- | --- |
| `id` | `SERIAL` | `PRIMARY KEY` |
| `email` | `TEXT` | `NOT NULL`, `UNIQUE` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Emails are stored lowercased and trimmed, to match the normalized compare in the auth middleware.

Foreign keys: none.

Indexes: the primary key on `id`, plus the unique constraint on `email`.

Owner authority comes from this table. See [Authentication](./authentication).

## Seed data

The schema seeds two tables. Both seeds are idempotent.

### Categories

This list is the initial seed applied to a fresh database. It is not a fixed set. Owners add, rename, and delete categories at runtime from the inventory UI, through the owner-only `/categories` endpoints (`POST` adds, `PUT` renames, `DELETE` removes). See [Authentication](./authentication) for owner-only access. So the live set will drift from this list over time.

The category seed inserts 15 rows, guarded by a `WHERE NOT EXISTS` check on `LOWER(name)`.

Food group:

| Name | display_order |
| --- | --- |
| Protein | 1 |
| Grains/Staples | 2 |
| Fruits and Vegetables | 3 |
| Dairy | 4 |
| Frozen Foods | 5 |
| Meals/Prepared Foods | 6 |
| Snacks | 7 |
| Breakfast Foods | 8 |
| Condiments & Cooking Essentials | 9 |
| Specialty/Dietary Items | 10 |
| Baby Items | 11 |

Non-food group:

| Name | display_order |
| --- | --- |
| Cleaning Supplies | 1 |
| Personal Care | 2 |
| Paper Goods | 3 |
| Baby & Child | 4 |

No items are seeded.

### Owners

The owner seed inserts 5 emails, each wrapped in `LOWER(TRIM(...))`, with `ON CONFLICT (email) DO NOTHING`:

- `ohjinwoo0608@gmail.com`
- `albert0515kim@gmail.com`
- `cameronlam2028@u.northwestern.edu`
- `fayma2029@u.northwestern.edu`
- `trashteam2026@gmail.com`

## Relationships summary

The foreign key graph is small. Five foreign keys link the inventory tables.

| Child | Parent | ON DELETE |
| --- | --- | --- |
| `items.category_id` | `categories.id` | `CASCADE` |
| `item_batches.item_id` | `items.id` | `CASCADE` |
| `item_barcodes.item_id` | `items.id` | `CASCADE` |
| `activity_log.item_id` | `items.id` | `SET NULL` |
| `activity_log.batch_id` | `item_batches.id` | `SET NULL` |

Deletes that cascade:

- Deleting a category deletes its items.
- Deleting an item deletes its batches and its barcodes.

Deletes that null out:

- Deleting an item sets `activity_log.item_id` to `NULL`.
- Deleting a batch sets `activity_log.batch_id` to `NULL`.

So deleting a category cascades down to its items, then to those items' batches and barcodes, while the related `activity_log` rows stay and their `item_id` and `batch_id` go to `NULL`.

An item delete is not written to `activity_log`. The log records adds and removes, not catalog deletes. See [Gotchas](./gotchas).
