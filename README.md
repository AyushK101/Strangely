# Strangely

Anonymous, client-driven WebRTC chat with server-side signaling & matchmaking.

## Overview

- Minimal monorepo implementing anonymous peer-to-peer video/chat using WebRTC.
- Signaling and matchmaking are handled by a lightweight WebSocket server; media and data flow peer-to-peer.

## Monorepo layout

- `apps/client` — React + Vite UI and WebRTC peer/media lifecycle ownership.
- `apps/server` — Node.js WebSocket signaling and anonymous matchmaking ownership.
- `packages/shared` — Shared message contracts, TypeScript types, and runtime schemas.
- `docs` — Architecture, protocol, and task planning documents.

## Quick start

Install dependencies and run both apps in dev mode:

```bash
pnpm install
pnpm dev
```

## Notes

- The client expects a signaling WebSocket at `VITE_SIGNALING_URL` (defaults to `ws://localhost:8080`). Configure with an environment variable for the dev server.
- The server port can be configured with `PORT` (defaults to `8080`).

## Development commands

- `pnpm dev` — run client and server concurrently (workspace scripts).
- `pnpm build` — build all packages.
- `pnpm test` — run tests across the workspace.

## Where to look

- Client entry: apps/client/src/App.tsx
- Server entry: apps/server/src/index.ts
- Shared contracts: packages/shared/src
- Docs: docs/

## Contributing

Follow the architectural boundaries: signaling and matchmaking live in `apps/server`; all WebRTC peer/media handling must remain on the client. Update `docs/architecture.md` and `packages/shared` when protocol changes.
