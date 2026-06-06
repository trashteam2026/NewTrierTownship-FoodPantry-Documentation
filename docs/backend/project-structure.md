---
id: project-structure
title: Project Structure
sidebar_position: 1
---

# Project Structure

The backend is an Express 5 app written in ES modules. It is deployed as a single Firebase Cloud Function that serves every route. For how the function is built and shipped, see [Deployment](./deployment). For the endpoint table and the core request logic, see [Architecture & Core Logic](./architecture).

## Directory layout

`index.js` sits at the repository root. Everything else lives under `src/`.

```
js-backend/
├── index.js                  # Cloud Function entry; wraps the Express app
└── src/
    ├── app.js                # builds and exports the Express app
    ├── server.js             # local dev entry (npm run dev)
    ├── config/
    │   ├── database.js       # pg Pool for Postgres/Supabase
    │   └── firebase.js       # firebase-admin init
    ├── middleware/
    │   └── authMiddleware.js # Firebase token check + owner gate
    ├── routes/
    │   ├── authRoutes.js
    │   ├── categoriesRoutes.js
    │   ├── itemRoutes.js
    │   ├── activityRoutes.js
    │   ├── barcodeRoutes.js
    │   ├── inventoryRoutes.js
    │   └── volunteerRoutes.js
    ├── controllers/
    │   ├── authController.js
    │   ├── categories.js
    │   ├── itemController.js
    │   ├── batchController.js
    │   ├── activityController.js
    │   ├── barcodeController.js
    │   ├── inventoryController.js
    │   └── volunteerController.js
    ├── repositories/
    │   ├── userRepository.js
    │   ├── inventoryRepository.js
    │   └── barcodeRepository.js
    └── providers/
        ├── postgresProvider.js
        └── mysqlProvider.js
```

## config/

`database.js` creates a `pg` connection pool from `DATABASE_URL`. The pool is small: `max` is 3, with short idle and connection timeouts. This sizing is for the Supabase transaction pooler (port 6543), which multiplexes many clients onto few server connections. A large pool per function instance would exhaust the pooler under fan-out. The pool is exported as both `pgPool` and `pool`, so older modules that import `pool` still work.

`firebase.js` initializes `firebase-admin`. If `FIREBASE_SERVICE_ACCOUNT_KEY` is set and holds a valid service account JSON, it uses that key. If the key is absent or empty, it falls back to Application Default Credentials, which is the deployed Cloud Function case. It also guards against double initialization on warm instances.

## middleware/

`authMiddleware.js` holds the auth layer. The default export reads the `Authorization: Bearer` header, verifies the Firebase ID token with `admin.auth().verifyIdToken`, and attaches the decoded token to `req.user`. The same file exports an owner check (`isOwnerEmail`, `isOwner`, `requireOwner`) that looks up the caller's email in the `owners` table, and a startup helper that warns when the owner allowlist is empty.

## routes/

Each route file builds an Express `Router`, attaches middleware, and binds paths to controller methods. `app.js` mounts each router under a prefix:

| Router | Prefix |
| --- | --- |
| `authRoutes.js` | `/auth` |
| `categoriesRoutes.js` | `/categories` |
| `itemRoutes.js` | `/items` |
| `activityRoutes.js` | `/activity` |
| `barcodeRoutes.js` | `/api/barcode` |
| `inventoryRoutes.js` | `/api/inventory` |
| `volunteerRoutes.js` | `/api/volunteer` |

`app.js` also defines `GET /health` inline, outside any router. For the full list of endpoints under each prefix, see [Architecture & Core Logic](./architecture).

## controllers/ and repositories/

The data access pattern is not uniform across controllers. There are two styles in the code.

Most controllers import `pgPool` from `config/database.js` and run SQL directly. `itemController.js`, `batchController.js`, `categories.js`, `activityController.js`, and `volunteerController.js` all build and run their own queries. There is no repository layer between these controllers and the database.

A few flows go through a repository module instead. `inventoryController.js` calls `inventoryRepository.js`, `barcodeController.js` calls `barcodeRepository.js`, and `authController.js` calls `userRepository.js`. Those repository files hold the SQL for their area.

So the layering is partial. The repository idea exists and is used by the inventory, barcode, and user paths, but the item, batch, category, activity, and volunteer paths skip it and query `pgPool` from the controller. Keep this in mind when reading or extending a controller: check first whether it has a matching repository or talks to the pool itself.

## providers/

The provider layer sits below the repositories and holds the database-specific SQL.

`postgresProvider.js` is the active one. It exports the user and owner queries (`createUser`, `upsertUser`, `findByUid`, `getAll`, `isOwnerEmail`) using `pg` parameter syntax. `userRepository.js` imports it and forwards each call to it.

`mysqlProvider.js` is a MySQL implementation of the same user and owner methods. It is unused. The import line in `userRepository.js` is commented out, and the MySQL pool block in `config/database.js` is commented out too. Postgres is the active path.

Only the user path uses this provider split. The inventory and barcode repositories query `pgPool` directly and have no provider behind them.

## app.js, server.js, index.js

`app.js` builds the Express app and exports it. It applies `helmet`, CORS, `cookie-parser`, and `express.json()`, collapses duplicate slashes in the URL, mounts the routers, defines `/health`, and adds a final error handler. It does not call `listen`. The Cloud Function loads this file.

`server.js` is the local dev entry. It imports the app from `app.js`, calls `app.listen` on `PORT` (default 5050), and runs the owner allowlist startup check. `npm run dev` runs `node src/server.js`. The Cloud Function does not load this file.

`index.js` at the repository root is the Cloud Function entry. It imports the app from `./src/app.js` and exports `api`, an `onRequest` HTTPS function that wraps the app. It sets the region to `us-central1` and lists the runtime secrets. The frontend's `firebase.json` rewrites the route prefixes to this function, so the mounted paths resolve the same way in deployment as in local dev.

## Where to add a new endpoint

Follow how the existing code is laid out. Add a route file (or a line in an existing one) under `routes/`, then mount it in `app.js` under a prefix if it is new. Put the handler in a controller under `controllers/`. For the data access, match the area you are working in: if it touches inventory, barcode, or user, use or extend the matching repository; otherwise the existing pattern queries `pgPool` from the controller. Add `authMiddleware` and `requireOwner` to the route if it needs auth, the same way the item and inventory routes do.
