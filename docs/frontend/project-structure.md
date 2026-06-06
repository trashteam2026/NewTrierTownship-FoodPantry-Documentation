---
id: project-structure
title: Project Structure
sidebar_position: 1
---

# Project Structure

The frontend is a React 19 app built with Vite. It uses styled-components for styling, Firebase Auth for sign-in, and talks to the backend over HTTP. For what each page does, see [Features](./features). For how the app is hosted, see [Deployment](./deployment). For the role model behind the route guards, see [Authentication](../authentication).

## Directory layout

`App.jsx`, `main.jsx`, and `firebase-config.js` sit at the top of `src/`. Everything else is grouped under `pages/`, `common/`, `services/`, and `utils/`.

```
src/
├── main.jsx                # React entry; mounts <App /> into #root
├── App.jsx                 # route tree and provider wrappers
├── firebase-config.js      # Firebase app init; exports auth and googleProvider
├── App.css
├── index.css
├── assets/
│   └── icons/              # SVG icons and the icons.js barrel
├── common/
│   ├── components/
│   │   ├── atoms/          # Button.jsx, GoogleButton.jsx
│   │   ├── form/           # Form.js, Input.jsx, SubmitButton.jsx, styles.js
│   │   ├── navigation/     # OwnerHeader.jsx
│   │   ├── routes/
│   │   │   └── ProtectedRoutes.jsx
│   │   └── PrintQuantityModal.jsx
│   ├── contexts/
│   │   ├── UserContext.jsx
│   │   └── ToastContext.jsx
│   ├── hooks/
│   │   └── useIsMobile.js
│   └── utils/
│       ├── backendUrl.js
│       └── volunteerInventory.js
├── pages/
│   ├── account/            # Login, SignUp, RequestPasswordReset, ResetPassword, AuthCallback
│   ├── activity/           # ActivityLogPage, DateRangePicker
│   ├── barcode/            # BarcodeGeneratorPage
│   ├── inventory/          # InventoryPage and its modals, rows, and menus
│   ├── landing/            # LandingPage
│   ├── not-found/          # NotFound
│   ├── scan-in/            # ScanInPage, ItemForm
│   ├── scan-out/           # ScanOutPage, CartLine
│   ├── volunteer/          # VolunteerEntryPage
│   └── volunteers/         # VolunteersPage
├── services/
│   └── api.js              # authenticated backend client
└── utils/
    └── barcodePrint.js     # barcode SVG render and print
```

The `@` alias resolves to `src/`. It is set in `vite.config.js`, so imports like `@/services/api` point at `src/services/api.js`.

## Routing

`App.jsx` wraps the route tree in `UserProvider`, then `ToastProvider`, then `BrowserRouter`. Routes are grouped by guard. Guarded routes render a guard element that wraps an `Outlet`. The table below lists every route.

| Path | Component | Guard |
| --- | --- | --- |
| `/` | `LandingPage` | none |
| `/volunteer/entry` | `VolunteerEntryPage` | `PublicOnlyRoute` |
| `/scan-in` | `ScanInPage` | `VolunteerOnlyRoute` |
| `/inventory` | `InventoryPage` | `OwnerOnlyRoute` |
| `/barcode-generator` | `BarcodeGeneratorPage` | `OwnerOnlyRoute` |
| `/activity` | `ActivityLogPage` | `OwnerOnlyRoute` |
| `/scan-out` | `ScanOutPage` | `OwnerOnlyRoute` |
| `/volunteers` | `VolunteersPage` | `OwnerOnlyRoute` |
| `/login` | `Login` | `PublicOnlyRoute` |
| `/signup` | `SignUp` | `PublicOnlyRoute` |
| `/forgot-password` | `RequestPasswordReset` | `PublicOnlyRoute` |
| `/auth/callback` | `AuthCallback` | none |
| `/auth/reset-password` | `ResetPassword` | none |
| `*` | `NotFound` | none |

## Route guards

The three guards live in `common/components/routes/ProtectedRoutes.jsx`. Each one reads `role` and `isLoading` from `UserContext`. While `isLoading` is true, a guard returns `null` and renders nothing. Once loading is done, the guard decides based on `role`.

- `PublicOnlyRoute` sends an `owner` to `/inventory` and a `volunteer` to `/scan-in`. Any other role renders the child route.
- `OwnerOnlyRoute` renders the child route only when `role` is `owner`. Otherwise it redirects to `/`.
- `VolunteerOnlyRoute` renders the child route only when `role` is `volunteer`. Otherwise it redirects to `/volunteer/entry`.

All redirects use `replace`. For how a user gets each role, see [Authentication](../authentication).

## Contexts

`UserProvider` in `common/contexts/UserContext.jsx` holds the auth state: `user`, `role`, and `isLoading`. It subscribes to Firebase `onAuthStateChanged`. When a Firebase user appears, the provider sets `role` based on the account type. An anonymous Firebase user is a volunteer, so `role` becomes `volunteer` with no backend call. Any non-anonymous user starts with `role` as `null` and stays pending until the backend resolves it. The provider fetches `/auth/profile` with the Firebase ID token in an `Authorization: Bearer` header. If the response is ok and `isOwner` is true, `role` becomes `owner`. If the fetch fails or the user is not an owner, `role` stays `null`. This is fail-closed: a profile-fetch failure never grants owner. The provider also exposes `login`, `logout`, `googleAuth`, and `requestPasswordReset`. `login` and `googleAuth` call `assertOwnerOrReject`, which signs the user back out and throws `auth/not-owner` when the account is not an owner. The `useUser` hook reads this context.

`ToastProvider` in `common/contexts/ToastContext.jsx` renders toast notifications through a portal on `document.body`. The `useToast` hook returns `showToast`. `showToast(message, variant)` adds a toast and accepts a variant of `info` (the default), `success`, or `error`. Each toast auto-dismisses after 2500ms and can be closed by its dismiss button.

## Services and backend communication

`services/api.js` is the authenticated backend client. It reads `BASE_URL` from `getBackendUrl()` once at module load. It defines two request helpers.

- `request(method, path, body)` sends a plain JSON request with `credentials: 'include'`. On a non-ok response it throws an `Error` with the backend `error` message or `HTTP <status>`.
- `authedRequest(method, path, body)` reads `auth.currentUser`, throws a 401 error when there is no user, and otherwise attaches the Firebase ID token as `Authorization: Bearer`. On a non-ok response it throws an `Error` with `.status`, `.code`, and `.body` set from the response, so callers can branch on backend error codes.

The file exports grouped API objects built on these helpers: `itemsApi`, `batchesApi`, `categoriesApi`, `activityApi`, `checkoutApi`, `barcodeApi`, and `volunteerApi`. Most calls use `authedRequest`. The one exception is `volunteerApi.verifyCode`, which uses the unauthenticated `request`.

`common/utils/volunteerInventory.js` is a separate module for the volunteer check-in path. It does not use `services/api.js`. It calls `fetch` directly and builds URLs from `getBackendUrl()`. `fetchCategories` and `addItem` attach the anonymous volunteer's Firebase token through `auth.currentUser.getIdToken()` when one is present, while `lookupByBarcode` posts without a token. `addItem` posts to `/api/inventory/check-in` and also records the saved item in `localStorage` under `pantry_volunteer_added_items`.

## Key utils

`common/utils/backendUrl.js` exports `getBackendUrl()`. It reads `VITE_BACKEND_URL` and fails loud: when the value is missing or blank it throws an error instead of falling back to a default. It trims the value and strips a trailing slash so callers can append paths that start with `/`.

`utils/barcodePrint.js` renders barcodes client-side and prints them. It encodes UPC-A and Code 128 barcodes as inline SVG (`renderUpcASvg`, `renderCode128Svg`, `renderBarcodeSvg`). `openBarcodePrintWindow` builds a label HTML document and prints it through a hidden, off-screen iframe with a fixed id, so no popup or blank tab is left behind. For more on the barcode and print flows, see [Features](./features).
