# Vercel Deployment Guide

## What Vercel deploys

Vercel deploys this repository from committed source through its Git integration. Its build installs dependencies, runs `npm run build`, publishes the generated `dist/` directory as the static frontend, and deploys files under `api/` as Vercel Functions.

`dist/index.html` is therefore an output of the deployment build, not an input to deployment. It must not be edited, committed, copied into a release branch, or uploaded to Vercel manually. A local `dist/index.html` may be inspected to verify that the single-file build succeeded, but it can always be deleted and regenerated from source.

The root `index.html` is the Vite source template. The standalone files downloaded through **Export HTML** are offline user snapshots. Neither should be confused with a manually managed hosted artifact.

## Automatic deployments

The Vercel project is connected to the Git repository.

- Pushes to `main` create Production deployments.
- Pushes to other branches create Preview deployments.
- Pull requests receive Preview deployments when enabled in the Vercel Git integration.

No separate upload of `dist/index.html` is required after a push. Follow deployment progress in the Vercel project's **Deployments** page.

Expected project settings:

```text
Framework Preset: Vite
Root Directory: .
Install Command: npm install
Build Command: npm run build
Output Directory: dist
Node.js: 24.x (or the project-supported current version)
```

## Server-side configuration

Production and Preview require:

- A private Vercel Blob store connected to the project using OIDC.
- The automatically injected `BLOB_STORE_ID` and short-lived OIDC credential.
- A server-only `KPI_LIBRARY_SECRET` environment variable.

The hosted Function should allow `@vercel/blob` to use OIDC automatically. `BLOB_READ_WRITE_TOKEN` is only a legacy/local fallback and should not be forced in hosted calls.

Development is a separate environment scope. Sensitive Vercel variables cannot target Development, so local testing may use a regular Development-scoped `KPI_LIBRARY_SECRET` or an ignored `.env.local` entry. Never commit `.env.local`, `.vercel/`, tokens, or secrets.

## Local development

Use Vercel's development server for the complete application:

```bash
npx vercel link
npx vercel env pull .env.local --environment=development
npx vercel dev
```

Restart `vercel dev` after environment changes. `npm run dev` and `npm run preview` can inspect the frontend, but they do not reproduce the `/api/config` Function.

## Pre-deployment verification

Run:

```bash
npm install
npm run build
```

The build verifies TypeScript and generates the ignored `dist/index.html`. A successful build does not authorize committing `dist/`.

For the API, verify locally through `npx vercel dev`:

- `GET /api/config` without a secret returns JSON HTTP 401.
- An authenticated `GET /api/config` returns HTTP 200 and the hosted configuration.
- Normal Save performs a three-way synchronization against the configuration this editor last loaded. Every explicit local deletion wins, untouched records retain remote edits or deletions, and independent top-level additions from both editors are preserved.
- Force Save replaces the complete JSON after confirmation.
- An exported HTML snapshot disables hosted write controls.

## Function packaging rule

The Vercel Function runs as native ESM. Relative imports reachable from `api/config.ts` must name the emitted JavaScript path:

```ts
// Correct
import { repairConfig } from '../src/configSchema.js';

// Incorrect in the deployed Function
import { repairConfig } from '../src/configSchema';
```

TypeScript and Vite resolve the `.js` specifier to the corresponding `.ts` source during development. Omitting the extension can work locally but fail after deployment with `ERR_MODULE_NOT_FOUND`.

## Production troubleshooting

If `/api/config` returns a Vercel plain-text 500 with `FUNCTION_INVOCATION_FAILED`, the Function crashed before it could return application JSON. Inspect **Vercel > Project > Logs**, expand the Function invocation, and read the runtime exception.

Useful CLI commands include:

```bash
npx vercel logs https://atspt-kpi-library.vercel.app --since 1h --status-code 500 --expand --no-branch
npx vercel list --environment production --limit 5
```

An unauthenticated healthy endpoint returns:

```text
HTTP 401
Content-Type: application/json
{"error":"Library access is required."}
```

Do not investigate or modify generated `dist/index.html` for a Function invocation failure. The relevant sources are `api/`, its imported server modules, Vercel environment configuration, and Runtime Logs.
