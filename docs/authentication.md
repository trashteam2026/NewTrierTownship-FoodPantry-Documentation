---
id: authentication
title: Authentication
sidebar_position: 3
---

# Authentication

The project currently uses Firebase Authentication on the frontend and Firebase Admin verification on the backend.

## Frontend Auth Flow

The frontend auth state is managed in:

```text
js-frontend/src/common/contexts/UserContext.jsx
```

That context listens to Firebase auth state and exposes:

- `user`
- `role`
- `isLoading`
- `login`
- `logout`
- `googleAuth`
- `requestPasswordReset`

The role model is currently simple:

- anonymous Firebase users are treated as `volunteer`
- non-anonymous users are treated as `owner`

Route guards live in:

```text
js-frontend/src/common/components/routes/ProtectedRoutes.jsx
```

Important route guards:

- `PublicOnlyRoute`: redirects logged-in owners to inventory and volunteers to scan-in
- `OwnerOnlyRoute`: protects administrator pages
- `VolunteerOnlyRoute`: protects the scan-in page for anonymous volunteer users
- `MobileOnlyRoute`: still exists, but it is not currently used by the routes in `App.jsx`

Current owner-only frontend routes:

- `/inventory`
- `/barcode-generator`
- `/activity`
- `/scan-out`
- `/volunteers`

Current volunteer-only route:

- `/scan-in`

The public volunteer entry route is:

- `/volunteer/entry`

## Backend Auth

Backend token verification lives in:

```text
js-backend/src/middleware/authMiddleware.js
```

It expects a Firebase ID token in:

```text
Authorization: Bearer <token>
```

The backend auth routes live in:

```text
js-backend/src/routes/authRoutes.js
js-backend/src/controllers/authController.js
```

## Current Caveats

Some inventory and category endpoints are not fully protected yet. The application has historically used frontend route protection for administrator access. Before production deployment, review every backend route and decide which endpoints must require Firebase auth.

Owner-only backend routes currently include:

- `POST /api/barcode/generate`
- `POST /api/inventory/check-out`
- `GET /api/volunteer/session`
- `POST /api/volunteer/session`
- `DELETE /api/volunteer/session`
- `GET /api/volunteer/volunteers`
- `GET /api/volunteer/stats`

Volunteer profile routes require a Firebase token, including anonymous volunteer users:

- `POST /api/volunteer/register`
- `GET /api/volunteer/me`

The volunteer code verification endpoint is public:

- `POST /api/volunteer/verify`

Known production-readiness tasks:

- enforce backend auth for administrator-only writes
- define durable roles instead of inferring owner/volunteer only from anonymous status
- audit whether volunteer check-in should require anonymous sign-in or be public
- remove any temporary local auth bypasses before deployment

## Handoff Notes

When debugging auth issues, check these in order:

1. Firebase client config in the frontend `.env`
2. Firebase service account JSON in the backend `.env`
3. browser console auth errors
4. backend logs from `authMiddleware`
5. route guard behavior in `ProtectedRoutes.jsx`
