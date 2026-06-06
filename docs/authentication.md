---
id: authentication
title: Authentication
sidebar_position: 3
---

# Authentication

Identity runs on Firebase Auth. The frontend signs users in with Firebase and `src/firebase-config.js` exports `auth` and `googleProvider`. There are three kinds of access: owner, volunteer, and public. Owner and volunteer carry a Firebase token. Public requests carry no token. See [Getting Started](./getting-started) for the Firebase environment variables.

## Roles

### Owner

An owner is a non-anonymous Firebase account whose email is in the `owners` database table. The client only sets the role to `owner` after `GET /auth/profile` returns `isOwner` true. That value is read in `UserContext.jsx`. The server derives `isOwner` from the `owners` table, so the table is the source of truth.

Login is owner-gated on the client. After a non-anonymous sign-in, `assertOwnerOrReject` in `UserContext.jsx` fetches `/auth/profile`. If `isOwner` is not true, it calls `signOut(auth)` and throws an error with code `auth/not-owner`. The login screen uses that to reject the account. This check fails closed: a failed profile fetch is treated as not an owner.

### Volunteer

A volunteer signs in anonymously. `VolunteerEntryPage.jsx` calls `signInAnonymously(auth)`. The client sets the role to `volunteer` from `firebaseUser.isAnonymous` in `UserContext.jsx`. The volunteer role does not depend on the backend, so it survives a profile-fetch failure.

A volunteer also needs a live session code to do check-ins. See [Gotchas & Known Behaviors](./gotchas).

### Public

Public requests send no token. These endpoints have no auth middleware on their routes:

- `POST /auth/signup`
- `GET /auth/profile`
- `POST /auth/token`
- `POST /api/barcode/lookup`
- `POST /api/volunteer/verify`
- `GET /health`

## How owner status is determined

The owner check on the backend is a chain. `requireOwner` calls `isOwner`, which calls `isOwnerEmail`, which calls `userRepository.isOwnerEmail`. `userRepository.js` holds no SQL of its own. It delegates to the active provider, which it imports from `postgresProvider.js`. The SQL that runs lives there:

```sql
SELECT 1 FROM owners WHERE email = LOWER(TRIM($1)) LIMIT 1
```

`isOwner` in `authMiddleware.js` short-circuits an anonymous user to non-owner. It returns false when `user.firebase?.sign_in_provider === 'anonymous'`, so a volunteer never passes the owner check.

Owners are seeded in `sql/schema.sql`. Emails are stored lower-cased and trimmed to match the normalized compare in the SQL above. To add an owner, insert their lower-cased and trimmed email into the `owners` table. See [Database Schema](./database-schema).

`warnIfOwnerAllowlistEmpty` in `authMiddleware.js` runs `SELECT COUNT(*) FROM owners` and logs a warning when the table is empty, so a deploy with no owners seeded does not lock everyone out of owner-only routes. The local dev server calls it at startup.

## Token flow

The frontend gets a Firebase ID token with `auth.currentUser.getIdToken()` and sends it as a Bearer token. `authedRequest` in `src/services/api.js` sets `Authorization: Bearer <token>`. `src/common/utils/volunteerInventory.js` does the same.

The backend verifies the token in `authMiddleware.js`. `authMiddleware` reads the `Authorization` header, takes the Bearer token, calls `admin.auth().verifyIdToken(token)`, and sets `req.user` to the decoded token.

`optionalAuth` verifies the token if one is present, and proceeds without setting `req.user` if it is missing or invalid. The check-in path uses `optionalAuth`.

`requireOwner` runs after `authMiddleware` and returns 403 when the request is not from an owner.

## Auth middleware responses

`authMiddleware.js` returns these statuses and messages:

- 401 `No Firebase ID token provided` when no Bearer token is present.
- 401 `Firebase ID token expired` when the error code is `auth/id-token-expired`.
- 401 `Invalid Firebase ID token` when the error code is `auth/invalid-id-token`.
- 500 `Internal server error during authentication` for any other verify failure.
- 403 `Owner access required` from `requireOwner` when the user is not an owner.

## Client sign-in methods

The client supports email and password and Google. `firebase-config.js` exports `auth` and `googleProvider`.

- Login: `Login.jsx` calls `login(email, password)` for email and password, and `googleAuth()` for Google. Both go through the owner gate described above.
- Sign up: `SignUp.jsx` sends `POST /auth/signup` with a `fetch` to the backend URL.
- Google redirect: `AuthCallback.jsx` handles the redirect result with `getRedirectResult(auth)` and posts the ID token to `POST /auth/token`. The Google popup path in `UserContext.jsx` also posts to `/auth/token`.
- Password reset: `RequestPasswordReset.jsx` calls `requestPasswordReset(email)`, which calls Firebase `sendPasswordResetEmail`. `ResetPassword.jsx` reads the `oobCode` query param and calls Firebase `confirmPasswordReset`.

## Route guards

`ProtectedRoutes.jsx` defines three guards. Each one renders nothing while `isLoading` is true.

- `PublicOnlyRoute`: redirects an owner to `/inventory` and a volunteer to `/scan-in`. Otherwise it renders the route.
- `OwnerOnlyRoute`: redirects to `/` when the role is not `owner`. Otherwise it renders the route.
- `VolunteerOnlyRoute`: redirects to `/volunteer/entry` when the role is not `volunteer`. Otherwise it renders the route.

`UserContext` is fail-closed. A non-anonymous user whose profile fetch fails gets no role, so the owner guard does not let them through.
