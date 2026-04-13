# Agent Operating Model

This repository uses a three-agent workflow for architecture-first delivery:

- planner: architecture, decomposition, sequencing, and risk control
- implementer: code scaffolding and feature implementation
- reviewer: quality validation, architecture compliance, and correctness checks

## Scope and Architecture Invariants

All agents must preserve these non-negotiable constraints:

1. Monorepo layout

- apps/client: React + Vite + TypeScript
- apps/server: Node.js + TypeScript
- packages/shared: shared types, schemas, and message contracts
- docs: architecture.md, api.md, tasks.md

2. Layer separation

- Server owns signaling and matchmaking over WebSocket.
- Client owns WebRTC peer connection and media/data channel lifecycle.
- Shared package owns contracts and schemas only.

3. Protocol separation

- WebSocket events are signaling/control plane only.
- WebRTC is media/data plane only.
- Do not route media through signaling server.

4. Implementation standards

- TypeScript only.
- ESM modules only.
- Modular boundaries required (no cross-layer shortcuts).

5. Documentation discipline

- Any architecture or protocol change must update docs.
- Code changes are incomplete unless docs are updated in the same work cycle.

## End-to-End Workflow

1. planner defines implementation slice and acceptance criteria.
2. implementer executes the slice with minimal, scoped changes.
3. reviewer validates behavior, architecture fit, and docs completeness.
4. If reviewer rejects, work returns to planner for reprioritization or implementer for fixes.
5. Merge only when reviewer passes all required checks.

## Handoff Contract

Every handoff must include:

- objective: what was attempted
- constraints: architecture and protocol rules applied
- touched areas: expected folders/files
- risks: known caveats and unresolved concerns
- verification: tests, lint, and manual checks run
- docs impact: files updated or intentionally unchanged with reason

## Decision Rules

- Prefer explicit state machines for session and connection lifecycle.
- Prefer deterministic event naming and versioned message envelopes.
- Prefer small vertical slices over broad unfinished implementation.
- Reject changes that blur signaling and media responsibilities.

## Done Criteria

A task is complete only when all are true:

- architecture constraints are preserved
- TypeScript and ESM conventions are preserved
- code quality checks pass
- docs reflect the final behavior
- reviewer has no blocking findings
