# Task Plan Baseline

## Phase 0: Bootstrap (Completed)

- [x] Establish pnpm workspace and root TypeScript baseline.
- [x] Scaffold `apps/client` with React + Vite + TypeScript.
- [x] Scaffold `apps/server` with TypeScript ESM signaling/matchmaking modules.
- [x] Scaffold `packages/shared` contracts/types/schemas package.
- [x] Document architecture and protocol boundaries.

## Phase 1: Shared Contract Hardening

- [x] Add schema coverage for all control and signaling payloads.
- [x] Add contract tests for envelope versioning and discriminated union integrity.

## Phase 2: Server Signaling + Matchmaking

- [x] Add idempotent matchmaking queue transitions.
- [x] Add timeout policies and stale session cleanup.
- [x] Add retry and skip flow semantics with explicit state transitions.

## Phase 3: Client WebRTC Lifecycle

- [x] Implement peer state machine for connect/match/offer/answer/ICE/teardown.
- [x] Implement reconnect and retry UX behavior.
- [x] Add telemetry hooks for lifecycle events.

## Phase 4: Verification

- [x] Add typecheck/lint/test CI workflow.
- [x] Add integrated smoke coverage for connect -> match -> signal relay -> teardown across server WebSocket integration and client lifecycle reducer tests.
