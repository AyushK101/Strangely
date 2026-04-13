# Architecture Baseline

## Monorepo Layout

- `apps/client`: React + Vite UI and WebRTC peer/media lifecycle ownership.
- `apps/server`: Node.js WebSocket signaling and anonymous matchmaking ownership.
- `packages/shared`: Shared message contracts, TypeScript types, and runtime schemas.
- `docs`: Architecture, protocol, and task planning documents.

## Plane Separation

- Control plane: WebSocket messages for session control and signaling metadata.
- Media plane: WebRTC peer connection for media/data transport between clients.
- The server never transports media; it only brokers signaling and matchmaking.

## Lifecycle Coverage

The baseline scaffolding models these lifecycle concerns:

- connect: peer joins signaling and enters matchmaking queue.
- disconnect: peer leaves queue/session due to client intent or transport loss.
- timeout: no match or stale session threshold reached.
- skip: peer requests next match.
- retry: peer re-enters matchmaking after failure/skip.
- offer/answer/ICE: SDP and candidate exchange over signaling channel only.

## Module Boundaries

- Client modules should include WebSocket client, peer lifecycle orchestration, and UI state.
- Server modules should include socket event ingestion, queue matching, and session registry.
- Shared modules should remain pure contracts/schemas without app runtime side effects.
