# Task Plan Baseline

## Phase 0: Bootstrap (Completed)

- [x] Establish pnpm workspace and root TypeScript baseline.
- [x] Scaffold `apps/client` with React + Vite + TypeScript.
- [x] Scaffold `apps/server` with TypeScript ESM signaling/matchmaking modules.
- [x] Scaffold `packages/shared` contracts/types/schemas package.
- [x] Document architecture and protocol boundaries.

## Phase 1: Shared Contract Hardening

- [ ] Add schema coverage for all control and signaling payloads.
- [ ] Add contract tests for envelope versioning and discriminated union integrity.

## Phase 2: Server Signaling + Matchmaking

- [ ] Add idempotent matchmaking queue transitions.
- [ ] Add timeout policies and stale session cleanup.
- [ ] Add retry and skip flow semantics with explicit state transitions.

## Phase 3: Client WebRTC Lifecycle

- [ ] Implement peer state machine for connect/match/offer/answer/ICE/teardown.
- [ ] Implement reconnect and retry UX behavior.
- [ ] Add telemetry hooks for lifecycle events.

## Phase 4: Verification

- [ ] Add typecheck/lint/test CI workflow.
- [ ] Add e2e smoke path for connect -> match -> signal relay -> teardown.
