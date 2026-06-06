---
id: features
title: Features
sidebar_position: 2
---

# Features

This page walks through each page and component in the frontend. For each one it
lists what it does, who uses it, the main components, and the backend endpoints
it calls. Endpoints are named by their `services/api.js` group and real path.

The app has two kinds of user: the **owner** (signed in with email/password or
Google) and the **volunteer** (signed in anonymously after entering a session
code). For how a user gets each role and how routes are gated, see
[Authentication](../authentication). For the endpoint contracts, see
[Architecture & Core Logic](../backend/architecture). For non-obvious behavior,
see [Gotchas & Known Behaviors](../gotchas). For where each file lives, see
[Project Structure](./project-structure).

Calls go through two helpers in `services/api.js`. `request` sends a plain
fetch. `authedRequest` attaches the current Firebase ID token and throws an
error that carries `.status`, `.code`, and `.body`, so callers can branch on
backend error codes like `BARCODE_NOT_FOUND` and `INSUFFICIENT_STOCK`.

## LandingPage

The home screen at `/`. Open to anyone.

It shows the pantry logo, the title "New Trier Township Food Pantry Check-in
System", and two buttons:

| Button | Goes to |
| --- | --- |
| Pantry Owner Login | `/login` |
| Volunteer Access | `/volunteer/entry` |

It reads `role` from the user context. If the role is already `owner` it
redirects to `/inventory`; if `volunteer` it redirects to `/scan-in`. It makes
no backend call.

## VolunteerEntryPage

The volunteer sign-in screen at `/volunteer/entry`. Used by volunteers.

It has a name field, a session code field, and a "Check In" button. A back arrow
returns to `/`. The submit flow runs three steps in order:

1. `volunteerApi.verifyCode(code)` &rarr; `POST /api/volunteer/verify` (public,
   no token). If the code is not valid it shows "Invalid or expired code."
2. `signInAnonymously(auth)` from Firebase, which flips the role to
   `volunteer`.
3. `volunteerApi.register({ name, code })` &rarr; `POST /api/volunteer/register`.

On success it navigates to `/scan-in`.

A registration failure happens after step 2 has already flipped the role, so the
route guard has navigated away and unmounted this page. The catch block stores
the message in a module-level variable (`pendingRegistrationError`), then calls
`signOut`. The sign-out bounces a fresh instance of this page back, and that new
instance seeds its error state from the stored value so the message shows once.
The variable is cleared on read.

## ScanInPage

The volunteer scanning screen at `/scan-in`. Used by volunteers.

**Camera scan.** It opens the rear camera with `BrowserMultiFormatReader` from
`@zxing/browser` (`decodeFromConstraints`, `facingMode: environment`). When a
barcode is read it stops the reader, calls `lookupByBarcode(barcode)` &rarr;
`POST /api/barcode/lookup` (public), and opens the [ItemForm](#itemform) in
scanned mode with any matched name and category prefilled. Camera state shows
"Starting camera...", a reticle when running, or "Camera unavailable" with a
text reason on error. The volunteer can still add items by hand from the error
state.

**Categories.** On mount it calls `fetchCategories()` &rarr;
`GET /api/inventory/categories` to fill the form's category options. On failure
it shows "Couldn't load inventory. Please try again."

**Add an item.** The form's submit handler calls `addItem(...)` &rarr;
`POST /api/inventory/check-in` with the volunteer's token. The returned
`activityLogId` is kept on the local session list so the entry can be edited or
deleted. After a save it shows a "Complete!" card that auto-dismisses after one
second.

**Manual add.** An "Add Item(s) Manually" button opens the form in manual mode
with no barcode.

**Profile and session polling.** On mount it calls
`volunteerApi.getMyProfile()` &rarr; `GET /api/volunteer/me` to load the
volunteer name and item count. It then polls the same endpoint every 60 seconds.
A `403` / `SESSION_ENDED` response, or a `404` after one retry, shows the
**session-ended overlay** "Code No Longer Active" with a "Leave" button. The
poll snapshots a mutation counter before each request so an in-flight local
add/delete is not overwritten by a stale server count. See [Gotchas](../gotchas).

**Session history.** A button with the volunteer name and item count opens a
"This Session" panel. Each row supports inline quantity edit and delete when it
has an `activityLogId`:

| Action | Endpoint |
| --- | --- |
| Edit quantity | `activityApi.updateLog(id, qty)` &rarr; `PATCH /activity/:id` |
| Delete entry | `activityApi.deleteLog(id)` &rarr; `DELETE /activity/:id` |

A failed delete shows a toast and leaves the row in place.

**Finish.** The back arrow and the "Finish Scanning" button both open a confirm
modal. Confirming runs `volunteerApi.finishVolunteering()` &rarr;
`DELETE /api/volunteer/me` (best effort), then `logout()` (Firebase `signOut`),
then navigates to `/`.

## ItemForm

The add-item form used inside [ScanInPage](#scaninpage). It takes data from the
parent and returns data to the parent through an `onSubmit` prop. It makes no
backend call of its own.

Fields:

- **Name**, with an autocomplete list built from existing item names. Picking a
  name that already exists also selects that item's category.
- **Category**, a dropdown of existing categories.
- **Expiration**, a month and year pair, or a "No expiration" checkbox that
  disables both.
- **Quantity**, a stepper with a minimum of 1.

Validation runs on submit: the name must be filled, a category must be chosen,
and an expiration must be set unless "No expiration" is checked. Each missing
field shows its own message.

When the form opens from a barcode that matched the inventory database (scanned
mode with `lookupSource === 'database'`), the name and category are locked and a
note reads "This item already exists in inventory." The submit button reads "Add
to Inventory."

## InventoryPage

The owner's main inventory screen at `/inventory`. Used by the owner.

It loads two endpoints on mount:

| Data | Endpoint |
| --- | --- |
| Categories | `categoriesApi.getAll()` &rarr; `GET /categories` |
| Items | `itemsApi.getAll()` &rarr; `GET /items` |

A load failure shows an error with a Retry button.

Layout pieces:

- [OwnerHeader](#ownerheader-profiledropdown-and-volunteercodemodal) with the
  search box. Typing filters items by name.
- [TabBar](#tabbar) for All Items / Food / Non-Food and category jump.
- CategorySection list, one block per category, each rendering its item rows.

**Sort.** A global sort applies to every category, with optional per-category
overrides. Modes: alphabetical, ascending stock, descending stock, expiration.
The filter control opens the [SortMenu](#sortmenu).

**Category management.** Buttons open the add, edit, and delete category modals
described below.

**Row click.** Clicking an item row sets the selected item id and opens the
[ItemDetailModal](#itemdetailmodal). On mobile a floating "+" button opens the
add-category modal.

## ItemDetailModal

The item detail and edit modal, opened from an inventory row. Used by the owner.

It loads the item with `itemsApi.getById(itemId)` &rarr; `GET /items/:id`.

Edits that hit the API:

| Edit | Endpoint |
| --- | --- |
| Name | `itemsApi.update(id, { name })` &rarr; `PUT /items/:id` |
| Category | `itemsApi.update(id, { category_id })` &rarr; `PUT /items/:id` |
| Low-stock threshold | `itemsApi.update(id, { low_stock_threshold })` &rarr; `PUT /items/:id` |
| Add batch | `batchesApi.create(id, data)` &rarr; `POST /items/:id/batches` |
| Update batch | `batchesApi.update(id, batchId, data)` &rarr; `PUT /items/:id/batches/:batchId` |
| Delete batch | `batchesApi.delete(id, batchId)` &rarr; `DELETE /items/:id/batches/:batchId` |
| Delete item | `itemsApi.delete(id)` &rarr; `DELETE /items/:id` |

Changing the category dropdown saves at once. The new id is read from the change
event, mapped from `''` to `null` else parsed to an int.

**Expiration grid.** Dated batches are grouped into a grid with years as rows and
months as columns. Each cell holds the summed quantity for that month. Clicking
a cell edits its quantity:

- An empty cell that gets a quantity creates a batch dated to the first of that
  month.
- Setting a cell to 0 deletes the batch or batches in that month.
- A cell with one batch updates that batch.
- A cell whose month holds batches with different expiration days prompts first:
  saving combines them into one batch.

After a grid save it refetches the item so the grid matches the server. See
[Gotchas](../gotchas) for the merge behavior.

**No-expiration batches** are listed on their own. Each row edits its quantity or
deletes the batch, and an "Add No-Expiration Batch" button creates a new batch
with quantity 0.

**Print and delete.** "Print Barcodes" opens the
[PrintQuantityModal](#printquantitymodal); the print itself is rendered in the
browser by `openBarcodePrintWindow` and makes no backend call. "Delete Item"
opens the nested [DeleteItemModal](#the-category-and-item-modals), which calls
`itemsApi.delete` on confirm.

## TabBar

The category tab strip on the inventory page. Used by the owner.

It has three tabs: All Items, Food Items, Non-Food. Tapping the active Food or
Non-Food tab opens a dropdown of that group's categories, with an "All Food
Items" entry at the top. Picking a category scrolls to it. The bar also holds the
add-category and filter (sort) controls. It makes no backend call; it reports
choices to InventoryPage through callbacks.

## SortMenu

The sort picker. Used by the owner.

It lists four options and reports the chosen value, then closes:

| Value | Label |
| --- | --- |
| `alphabetical` | Alphabetical |
| `stock_asc` | Ascending Stock |
| `stock_desc` | Descending Stock |
| `expiration` | Expiration Dates |

Escape and the close button dismiss it. It makes no backend call.

## The category and item modals

These modals open from the inventory page or from ItemDetailModal. All are owner
only.

**AddCategoryModal.** Opened by the add-category control. Fields: a name and a
group dropdown (Food / Non-Food). Submit calls the page's `onAdd`, which runs
`categoriesApi.create({ name, parentGroup })` &rarr; `POST /categories`. Cancel
or the close button dismisses it.

**EditCategoryModal.** Opened from a category. It edits the name and calls the
page's `onSave`, which runs `categoriesApi.update(id, { name })` &rarr;
`PUT /categories/:id`. A failure shows an inline message. A "Delete Category"
button opens the delete modal. Enter saves; Escape closes.

**DeleteCategoryModal.** It warns that deleting the category removes its items
and adds them to the activity log, and that this cannot be undone. Confirm runs
`categoriesApi.delete(id)` &rarr; `DELETE /categories/:id`. Cancel dismisses it.

**DeleteItemModal.** Opened from ItemDetailModal. It confirms deletion of one
item and warns the action cannot be undone. Confirm runs the parent's
`onConfirm`, which is `itemsApi.delete`. Cancel dismisses it.

## PrintQuantityModal

The label-count modal, used before printing barcodes from
[ItemDetailModal](#itemdetailmodal) and
[BarcodeGeneratorPage](#barcodegeneratorpage). Owner only.

It has one number field, "Labels per barcode", that defaults to 1. On submit it
checks the value is a whole number between 1 and 100. A bad value shows "Enter a
whole number between 1 and 100." inline. On a valid value it calls the parent's
`onPrint` with the parsed count. The submit button reads "Open Printable PDF."
The modal makes no backend call.

## OwnerHeader, ProfileDropdown, and VolunteerCodeModal

`OwnerHeader` is the top bar shown on every owner page. It carries the brand,
an optional search box, and the navigation icons:

| Icon | Goes to |
| --- | --- |
| Inventory | `/inventory` |
| Scan Out | `/scan-out` (a desktop icon; on mobile a floating button) |
| Activity | `/activity` |
| Volunteers | `/volunteers` |
| Barcode Generator | `/barcode-generator` |
| Profile | opens the ProfileDropdown |

`ProfileDropdown` holds two actions. "Volunteer Session" opens the
VolunteerCodeModal. "Log Out" runs `logout()`.

`VolunteerCodeModal` manages the volunteer session code. Owner only. On open it
calls `volunteerApi.getSession()` &rarr; `GET /api/volunteer/session`.

| State | Action | Endpoint |
| --- | --- | --- |
| No active code | "Generate Code" | `volunteerApi.generateSession()` &rarr; `POST /api/volunteer/session` |
| Active code | "Generate New Code" | `volunteerApi.generateSession()` &rarr; `POST /api/volunteer/session` |
| Active code | "End Session" | `volunteerApi.endSession()` &rarr; `DELETE /api/volunteer/session` |

When a code is active the modal shows the code, its expiry, and a copy button.
"End Session" opens a confirm step that warns all active volunteers will be
removed and a new code must be generated. The endpoint runs only after that
confirm; on success it closes both the confirm step and the modal. For how End
Session and Generate New Code differ on the backend, see [Gotchas](../gotchas).

## ScanOutPage

The owner's check-out screen at `/scan-out`. Used by the owner.

**Scanner input** depends on the device:

- **Mobile** uses the `@zxing/browser` camera. Repeated reads of the same code
  inside a debounce window are ignored.
- **Desktop** listens for a USB barcode scanner acting as a keyboard wedge. It
  buffers printable keys and submits the buffer on Enter when it meets a minimum
  length. Keys aimed at inputs, textareas, selects, or editable elements are
  ignored.

It loads the catalog with `itemsApi.getAll()` &rarr; `GET /items` so a scan can
show the item name at once and so a manual pick can search by name.

**Cart.** Each scan adds a line, or bumps the quantity of a matching open line.
Lines can have their quantity changed or be removed while editable.

**Submit.** Pressing check out loops over the cart and calls
`checkoutApi.checkOut({ barcode | itemId, quantity })` &rarr;
`POST /api/inventory/check-out` once per line. Per-line results:

| Result | UI |
| --- | --- |
| Success | line marked done, shows "Removed", then fades out |
| `BARCODE_NOT_FOUND` (404) | "Barcode not in catalog." with a manual-pick search to choose the item |
| `INSUFFICIENT_STOCK` (409) | "Only N in stock. Adjust quantity or remove." |
| `401` / `403` | stops the batch and shows one global error |

The loop is non-atomic: lines are checked out one at a time, so some can succeed
while others fail, and a failed line stays in the cart for a retry. See
[Gotchas](../gotchas).

## ActivityLogPage

The owner's activity and stats screen at `/activity`. Used by the owner.

It loads logs with `activityApi.getLogs({ start, end })` &rarr;
`GET /activity?start=&end=`. The default range is the current month in
America/Chicago. A load failure shows an error with a Retry button.

"Today's Traffic" is fetched on its own, once on mount, with `getLogs` scoped to
today's Chicago date. It does not change when the selected range changes.

Logs are grouped by Chicago calendar date, with each day split into items added
and items removed. The header search is debounced by 300 ms before it filters
the grouped list.

A "Select Date Range" button opens the **DateRangePicker** modal. The picker is a
month calendar; a click sets the start, a second click sets the end. "OK" applies
the range and "Cancel" closes without change.

## VolunteersPage

The owner's volunteer screen at `/volunteers`. Used by the owner.

It loads two lists:

| Section | Endpoint |
| --- | --- |
| Active Now | `volunteerApi.getActiveVolunteers()` &rarr; `GET /api/volunteer/volunteers` |
| Volunteer History | `volunteerApi.getVolunteerHistory()` &rarr; `GET /api/volunteer/history` |

Each section has its own refresh button and its own load-failure message with a
Retry button. The history response carries a `truncated` flag; when set, a row
reads "Showing the 500 most recent scan-ins." History covers the current code.

## BarcodeGeneratorPage

The owner's barcode tool at `/barcode-generator`. Used by the owner.

On mount it loads categories with `categoriesApi.getAll()` &rarr;
`GET /categories`. The form takes an item name and a category, then submits with
`barcodeApi.generate({ name, categoryId })` &rarr; `POST /api/barcode/generate`.

On success a "Barcode Created" modal shows the item, category, and barcode, with
two actions: "Open Printable PDF" opens the
[PrintQuantityModal](#printquantitymodal) and then prints through
`openBarcodePrintWindow` (browser side, no backend call), and "Back to Inventory"
navigates to `/inventory`.

## Account pages

These handle owner sign-in and password reset. For the role model and the owner
gate, see [Authentication](../authentication).

**Login** (`/login`). Email and password submit through the user context's
`login`. A Google button submits through `googleAuth`. The owner gate runs on the
backend; a non-owner account maps to the message "This login is for pantry owners
only." On an owner role the page redirects to `/inventory`.

**SignUp** (`/signup`). The form posts to `POST /auth/signup` through
`getBackendUrl()`. On success it navigates to `/login`. A Google button runs
`googleAuth`.

**AuthCallback** (`/auth/callback`). It reads the Firebase redirect result with
`getRedirectResult`, posts the token to `POST /auth/token`, then redirects by
role. On failure it returns to `/login` with the error.

**RequestPasswordReset** (`/request-password-reset`). It calls the context's
`requestPasswordReset(email)` and shows a confirmation message on success.

**ResetPassword** (`/reset-password`). It reads the `oobCode` from the URL query.
On submit it checks the password rules and that both entries match, then calls
Firebase `confirmPasswordReset(auth, oobCode, password)` and navigates to
`/login`.
