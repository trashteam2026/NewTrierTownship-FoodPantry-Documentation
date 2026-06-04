---
title: Frontend Project Structure
sidebar_position: 1
---

# Frontend Project Structure

The frontend repository is:

```text
js-frontend/
```

It is a React app built with Vite. Styling is primarily done with `styled-components`, and icons are generally imported from `react-icons`.

## Top-Level Files

```text
js-frontend/
  index.html
  package.json
  vite.config.js
  src/
```

Important scripts:

```bash
npm run dev
npm run build
npm run test
```

The `lint` script currently formats with Prettier:

```bash
npm run lint
```

## Source Layout

```text
src/
  App.jsx
  main.jsx
  services/
  common/
  pages/
  assets/
  utils/
```

## Routing

Application routes are declared in:

```text
src/App.jsx
```

Important pages:

- `/` landing page
- `/login`
- `/signup`
- `/forgot-password`
- `/auth/callback`
- `/auth/reset-password`
- `/inventory`
- `/barcode-generator`
- `/activity`
- `/scan-out`
- `/volunteers`
- `/scan-in`
- `/volunteer/entry`

Route protection is handled by components in:

```text
src/common/components/routes/ProtectedRoutes.jsx
```

## API Layer

The administrator API client lives in:

```text
src/services/api.js
```

It wraps `fetch` and exports:

- `itemsApi`
- `batchesApi`
- `categoriesApi`
- `activityApi`
- `checkoutApi`
- `barcodeApi`
- `volunteerApi`

Volunteer check-in uses a separate helper:

```text
src/common/utils/volunteerInventory.js
```

That file handles:

- barcode lookup
- category loading for volunteer forms
- item check-in
- small localStorage history for volunteer-added items

## Common Code

Shared code lives under:

```text
src/common/
  components/
  contexts/
  hooks/
  layouts/
  utils/
```

Key files:

- `contexts/UserContext.jsx`: Firebase auth state and user actions
- `hooks/useIsMobile.js`: mobile route detection
- `components/routes/ProtectedRoutes.jsx`: route guards
- `components/navigation/`: shared nav/logout UI

## Inventory Page

Inventory-related components live in:

```text
src/pages/inventory/
```

Important files:

- `InventoryPage.jsx`: main admin inventory view and state orchestration
- `CategorySection.jsx`: category header, item list, category-level filter menu
- `ItemRow.jsx`: row for an item summary
- `ItemDetailModal.jsx`: item detail popup for batches, stock threshold, name, and category editing
- `AddCategoryModal.jsx`: add category modal
- `EditCategoryModal.jsx`: rename/delete category flow
- `DeleteCategoryModal.jsx`: confirmation for deleting categories
- `TabBar.jsx`: top category group selector
- `SortMenu.jsx`: global inventory sort menu

## Scan-In Page

Volunteer scan/check-in code lives in:

```text
src/pages/scan-in/
```

Important files:

- `ScanInPage.jsx`: camera scanner and page-level workflow
- `ItemForm.jsx`: scanned/manual item form

The scanner uses `@zxing/browser`.

## Scan-Out Page

Administrator checkout code lives in:

```text
src/pages/scan-out/
```

Important files:

- `ScanOutPage.jsx`: barcode scanner, checkout cart, and checkout submission workflow
- `CartLine.jsx`: cart line editing, item selection for unknown barcodes, and line-level errors

Checkout requests use `checkoutApi.checkOut`, which sends authenticated requests to:

```text
POST /api/inventory/check-out
```

## Barcode Generator Page

Internal barcode generation code lives in:

```text
src/pages/barcode/BarcodeGeneratorPage.jsx
src/utils/barcodePrint.js
```

The page calls `barcodeApi.generate`, then renders and prints generated barcodes with the shared barcode print utility.

## Volunteers Page

Volunteer management code lives in:

```text
src/pages/volunteers/VolunteersPage.jsx
src/pages/inventory/VolunteerCodeModal.jsx
src/pages/volunteer/VolunteerEntryPage.jsx
```

Administrators can generate or end an active volunteer session code. Volunteers enter the code from `/volunteer/entry`, register their name after anonymous Firebase sign-in, and then use `/scan-in`.

## Activity Page

Activity log code lives in:

```text
src/pages/activity/
```

Important files:

- `ActivityLogPage.jsx`
- `DateRangePicker.jsx`

The page reads from `activityApi.getLogs`.

Volunteer-created activity entries can also call `activityApi.updateLog` and `activityApi.deleteLog` from the scan-in workflow when the backend authorizes the current Firebase UID for that log entry.
