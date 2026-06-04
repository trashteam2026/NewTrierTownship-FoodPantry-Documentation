---
title: Frontend Features
sidebar_position: 2
---

# Frontend Features

This page summarizes the current user-facing frontend behavior for future maintainers.

## Administrator Inventory View

The inventory page is the main administrator surface. It loads categories and items from the backend, combines them in React state, and renders each category as a section.

Current functionality:

- view inventory grouped by category
- switch between all, food, and non-food items
- filter to a specific category from the top tabs
- search item names
- globally sort visible items by name or stock
- sort individual category sections by:
  - alphabetical
  - stock high to low
  - stock low to high
- add new categories
- rename categories
- delete categories
- add items inside a category
- open item detail popup
- open the barcode generator
- open the scan-out checkout page
- open volunteer management
- start or end a volunteer session code

## Item Detail Popup

The item detail popup is in:

```text
src/pages/inventory/ItemDetailModal.jsx
```

It currently supports:

- viewing total count
- editing item name
- editing item category
- editing low-stock threshold
- viewing item barcodes
- printing item barcodes
- viewing quantities by expiration month/year
- editing batch quantities by double-clicking grid cells
- adding no-expiration batches
- deleting no-expiration batches
- deleting an item

When editing item name or category, the frontend calls:

```text
PUT /items/:id
```

Only the changed item field is updated; stock batches remain attached to the same item.

## Category Management

Adding categories uses:

```text
POST /categories
```

The Add Category modal intentionally only asks for:

- category name
- food/non-food group

The older "Move Items" UI was removed because its behavior was unclear. If the team later wants category merge/move tools, add that as a separate, explicit workflow.

Deleting categories uses:

```text
DELETE /categories/:id
```

The backend is responsible for deleting the category's items and writing activity log entries for removed stock.

## Volunteer Sessions

Administrators can open the volunteer session modal from the owner pages. The modal uses `volunteerApi` to:

- get the current session
- generate a new session code
- end the current session

Volunteers enter a session code on:

```text
/volunteer/entry
```

After code verification and anonymous Firebase sign-in, the volunteer registers their name and is sent to scan-in.

## Volunteer Scan-In

The scan-in page is intended for volunteers and is protected by `VolunteerOnlyRoute`.

Current behavior:

- starts a camera scanner
- detects barcodes using `@zxing/browser`
- checks the backend database first for barcode matches
- falls back to external barcode lookup providers
- lets volunteers enter item/category/expiration/quantity
- sends check-ins to the backend
- shows the active volunteer name from the volunteer profile endpoint
- lets the volunteer update or delete their own recent check-in activity when the backend authorizes it

Known detail: if a scanned barcode already belongs to an existing item, the form locks the item name/category so volunteers do not accidentally rename existing inventory.

## Scan-Out Checkout

The scan-out page is an owner-only checkout workflow.

Current behavior:

- scans or enters barcodes
- builds a checkout cart
- supports quantity edits before submitting
- lets administrators choose an item when a scanned barcode is not registered
- submits checkout requests to the backend
- displays line-level errors for unknown barcodes or insufficient stock

The backend handles the actual stock removal.

## Barcode Generator

The barcode generator page is owner-only.

Current behavior:

- accepts an item name and category
- requests a generated internal barcode from the backend
- previews the generated barcode
- prints generated barcode labels

## Activity Log

The activity log page displays backend activity records.

Currently tracked events include:

- inventory check-ins
- inventory check-outs
- category deletion removals when items with quantity are deleted

The activity API supports date filtering, and volunteer-created check-in entries can be edited or deleted by the same volunteer UID when the backend can safely adjust the associated batch.

Future maintainers should make sure every destructive inventory operation has a clear activity log story.

## Known UI Caveats

- Some admin controls have evolved quickly; verify layout after changing button groups or dropdowns.
- The global `Filter All` menu includes an expiration option, but expiration sorting may need more complete implementation.
- Docusaurus/docs deployment is not finalized yet and should be documented later.
