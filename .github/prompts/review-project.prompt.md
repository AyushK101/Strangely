# Prompt: Review Project

Use this prompt for milestone reviews, PR reviews, or architecture compliance audits.

## Goal

Assess quality, correctness, and architecture alignment with findings-first output.

## Prompt Template

Review target:

- [commit/branch/feature/milestone]

Review focus:

- bugs and regressions
- protocol correctness
- lifecycle handling
- race conditions in matchmaking/session management
- docs completeness and accuracy

Constraints:

- Report findings first, ordered by severity.
- Include concrete file locations and rationale.
- Validate signaling/media separation and shared-contract integrity.
- Confirm TypeScript/ESM and modularity rules are preserved.

Execution mode:

1. planner:

- define review checklist based on scope

2. reviewer:

- inspect code, run checks, and produce severity-ranked findings

3. implementer (if requested):

- address findings and resubmit with verification evidence

Required output:

- blocking findings
- non-blocking findings
- test and lint coverage gaps
- final recommendation (pass/fail)
