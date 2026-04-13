# Copilot Instructions

## Role

Act as a senior engineer in a monorepo for a real-time anonymous chat system.

## Hard Constraints

1. Respect repository boundaries:
- apps/client: UI, WebRTC setup, peer lifecycle
- apps/server: WebSocket signaling, matchmaking, session lifecycle
- packages/shared: contracts, types, schemas
- docs: architecture and protocol documentation

2. Keep signaling and media separate:
- Signaling and matchmaking use WebSocket on server.
- Media/data transport uses WebRTC peer connection on client.
- Do not move media responsibilities into server signaling modules.

3. Use TypeScript and ESM consistently.

4. Keep modules small and cohesive.

5. Update docs whenever behavior, protocol, architecture, or task plan changes.

## Coding Standards

- Favor explicit interfaces, discriminated unions, and strict typing.
- Prefer pure functions for protocol mapping and validation.
- Use deterministic event names and versioned message envelopes.
- Keep server session/matchmaking logic idempotent and race-safe.
- Handle timeout, disconnect, and retry flows explicitly.
- Avoid hidden coupling between client and server internals.

## Response Style

- State assumptions before implementation.
- Propose concise plan for multi-step work.
- Keep changes scoped; avoid unrelated refactors.
- Summarize touched files, risks, and verification status.
- If blocked, describe exact blocker and the smallest next action.

## Quality Checklist

Before finalizing any change, verify:

- architecture boundaries are intact
- signaling protocol changes are reflected in shared contracts
- WebRTC lifecycle handling covers offer, answer, ICE, and teardown
- reconnect, skip, and timeout paths are handled
- docs in docs/ are updated as needed
