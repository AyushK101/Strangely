# Prompt: Add New Feature

Use this prompt for any new product or protocol capability.

## Goal

Implement a feature while preserving architecture boundaries and updating docs.

## Prompt Template

Feature request:
- [Describe feature]

Context:
- impacted layers: [client/server/shared/docs]
- protocol impact: [yes/no, details]
- lifecycle impact: [connect/disconnect/timeout/skip/retry]

Constraints:
- Respect monorepo boundaries.
- Do not mix signaling and media responsibilities.
- Shared contracts must be updated before integration.
- TypeScript + ESM only.
- Docs updates are mandatory when behavior changes.

Execution mode:
1. planner:
- break feature into implementation slices
- define acceptance criteria and edge cases
- specify files/folders allowed to change
2. implementer:
- implement minimal scoped changes
- run build/lint/typecheck/tests as applicable
- update docs
3. reviewer:
- report findings by severity
- verify architecture and protocol correctness
- pass/fail decision

Required output:
- assumptions
- plan
- changed modules by layer
- protocol/lifecycle notes
- verification evidence
- reviewer findings and outcome
