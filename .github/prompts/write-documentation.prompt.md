# Prompt: Write Documentation

Use this prompt when creating or updating architecture, protocol, or execution docs.

## Goal

Produce clear, implementation-aligned documentation for this monorepo.

## Prompt Template

Documentation task:

- [Describe what docs need to be created or updated]

Inputs:

- related code changes: [list]
- target docs: [docs/architecture.md, docs/api.md, docs/tasks.md, other]

Constraints:

- Document signaling (WebSocket) and media (WebRTC) separately.
- Reflect shared contracts from packages/shared.
- Include lifecycle behavior: connect, disconnect, timeout, skip, retry.
- Keep event names and envelope versions consistent with code.

Execution mode:

1. planner:

- define documentation scope and outline
- identify missing technical details

2. implementer:

- write or update docs with examples and sequence clarity
- ensure terminology consistency

3. reviewer:

- verify docs accuracy against implementation
- flag ambiguities, omissions, and outdated sections

Required output:

- docs changed
- summary of new/updated sections
- consistency checks performed
- unresolved questions
