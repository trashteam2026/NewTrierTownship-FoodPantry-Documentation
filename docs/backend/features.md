---
title: Backend Features
sidebar_position: 2
---

# Backend Features

This page summarizes the current backend behavior and the areas maintainers should understand before making changes.

## Inventory Items

Items are stored in:

```text
items
```

Important fields:

- `id`
- `name`
- `category_id`
- `low_stock_threshold`
- `barcode` legacy column
- `created_at`

Item quantities are not stored directly on the item row. Quantities come from item batches.

## Item Batches

Batches are stored in:

```text
item_batches
```

Important fields:

- `item_id`
- `expiration_date`
- `quantity`

The database has a uniqueness rule for:

```text
(item_id, expiration_date)
```

This lets repeated check-ins for the same item and expiration date combine into one batch row.

## Multiple Barcodes Per Item

Multiple barcodes are stored in:

```text
item_barcodes
```

Each barcode is globally unique and points to one item.

Current behavior:

- barcode lookup checks `item_barcodes`
- if a barcode is known, it returns the existing item name/category
- item detail responses include barcode data
- old `items.barcode` values are backfilled into `item_barcodes`

Important caution: do not join `item_barcodes` directly into aggregate item quantity queries unless the query accounts for duplication. Joining many barcodes to many batches can accidentally multiply stock counts.

## Categories

Categories are stored in:

```text
categories
```

Important fields:

- `name`
- `parent_group`: `food` or `non_food`
- `display_order`

Current taxonomy:

Food:

- Protein
- Grains/Staples
- Fruits and Vegetables
- Dairy
- Frozen Foods
- Meals/Prepared Foods
- Snacks
- Breakfast Foods
- Condiments & Cooking Essentials
- Specialty/Dietary Items
- Baby Items

Non-food:

- Cleaning Supplies
- Personal Care
- Paper Goods
- Baby & Child

## Category Deletion

Deleting a category now deletes the items in that category.

Before deleting those items, the backend sums each item's batch quantities and writes a `removed` activity log entry for any item with stock greater than zero.

This is handled in:

```text
src/controllers/categories.js
```

The deletion is transactional:

1. find category
2. find items in category
3. log removed stock
4. delete items
5. delete category
6. commit

If anything fails, the transaction rolls back.

## Activity Log

Activity entries are stored in:

```text
activity_log
```

Important fields:

- `item_id`
- `item_name`
- `action`
- `quantity`
- `created_at`

Current valid actions:

- `added`
- `removed`

The activity endpoint supports optional date filtering:

```text
GET /activity?start=YYYY-MM-DD&end=YYYY-MM-DD
```

## Barcode Lookup

Barcode lookup happens in:

```text
src/controllers/barcodeController.js
src/repositories/barcodeRepository.js
```

Lookup order:

1. local inventory barcode match
2. custom barcode mapping
3. Open Food Facts
4. UPCItemDB fallback

The local database match should always win, because pantry-specific names/categories are more trustworthy than third-party product labels.

## Check-In Flow

Volunteer check-ins use:

```text
POST /api/inventory/check-in
```

The backend:

- validates name, expiration date, quantity, category, and threshold
- normalizes expiration dates to `YYYY-MM-DD`
- finds or creates the item
- attaches a barcode when provided
- inserts or increments the matching batch
- writes activity for added stock

## Maintenance Notes

- Be careful changing item/category delete behavior; always consider activity logging.
- Keep SQL migrations and `create_tables.sql` in sync.
- Prefer explicit migrations for destructive changes.
- Avoid committing secrets from `.env`.
- Before deployment, add route-level authorization for admin-only operations.
