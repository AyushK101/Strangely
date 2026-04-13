# Prompt: Bootstrap Project

Use this prompt when initializing the monorepo foundation.

## Goal

Set up the repository baseline for a real-time anonymous chat system with:

- apps/client (React + Vite + TypeScript)
- apps/server (Node.js + TypeScript)
- packages/shared (contracts/types/schemas)
- docs (architecture.md, api.md, tasks.md)

## Prompt Template

You are operating in this repository as planner, then implementer, then reviewer.

Objective:
- Bootstrap monorepo scaffolding and baseline architecture artifacts.

Constraints:
- Use pnpm workspace.
- Keep signaling and matchmaking in server via WebSocket.
- Keep WebRTC peer/media lifecycle in client.
- Keep shared contracts in packages/shared only.
- Use TypeScript and ESM across all packages.
- Update docs with architecture and protocol baseline.

Execution mode:
1. planner: produce phased bootstrap task list and acceptance criteria.
2. implementer: create only baseline scaffolding and foundational modules.
3. reviewer: validate architecture boundaries and baseline quality checks.

Deliverables:
- folder structure and package setup
- initial shared contracts and versioned envelope shape
- docs/architecture.md, docs/api.md, docs/tasks.md baseline content
- verification summary

Output format:
- assumptions
- plan
- changes made
- checks run
- risks and next tasks
