# OpenCode validation scripts

These scripts are one-shot helpers for validation and deterministic run-artifact generation. Writer scripts only write `.opencode/run-artifacts/<run_id>/**`, support `--check` dry-run, and never commit, merge, clean worktrees, stop processes, install packages, or change runtime state.

## Agent rules

Run after editing `.opencode/agents/*.md` or `.opencode/scripts/*.js`:

```bash
node .opencode/scripts/agent-contract-check.js --strict
node .opencode/scripts/test-checkers.js
```

`agent-contract-check.js` validates the canonical artifact registry, compact output fields, alias namespace blockers, stale placeholders, and immutable skill diffs.

## Run artifacts

Run when a concrete run artifact directory exists:

```bash
node .opencode/scripts/artifact-schema-check.js .opencode/run-artifacts/<run_id> --strict
```

`artifact-schema-check.js` validates summary/index/lock/packet common fields, `dispatch-ledger/v1`, `runner-event/v1`, source refs/hashes, fallback actions, status values, and `worktree/<run_id>/*` branch namespace.

Compact flow artifacts such as `run-preflight-packet/v1`, `verification-matrix/v1`, `package-decision-record/v1`, `experience-contract/v1`, and `context-slice/v1` are treated as summary artifacts. They must include common source refs, source hashes, status, blockers, detail refs, and fallback actions; they never replace the full planner, project rules, dispatch ledger, runner events, or final maintained report.

Speed artifacts such as `openspec-template-contract/v1`, `apply-readiness-checklist/v1`, `snapshot-manifest/v1`, and `commit-metadata-summary/v1` follow the same common summary contract. They optimize formatting, snapshot sync, apply readiness checks, and final report generation, but stale or blocked summaries must fall back to the original OpenSpec artifacts, source worktree files, or git history.

If `.opencode/run-artifacts` does not exist, the checker reports `skipped`; this is expected outside an active run.

## Speed artifact builders

Use these after planner/classification decisions exist to reduce repeated long-context reads. All generated artifacts are summaries only; stale, blocked, missing, or hash-mismatched artifacts must fall back to the full source gate.

```bash
node .opencode/scripts/build-run-preflight-packet.js <run_id> --planner <path>
node .opencode/scripts/build-verification-matrix.js <run_id> --planner <path>
node .opencode/scripts/build-package-decision-record.js <run_id> --planner <path>
node .opencode/scripts/build-experience-contract.js <run_id> --planner <path>
node .opencode/scripts/build-project-rules-lock.js <run_id>
node .opencode/scripts/build-skill-lock.js <run_id>
node .opencode/scripts/build-dependency-readiness.js <run_id>
node .opencode/scripts/build-planner-index.js <run_id> --planner <path>
node .opencode/scripts/build-context-slices.js <run_id> --ready-wave <id>
node .opencode/scripts/build-snapshot-manifest.js <run_id> --stage <n> --wave <id>
node .opencode/scripts/build-port-map.js <run_id> --stage <n> --wave <id>
node .opencode/scripts/build-dispatch-ledger-skeleton.js <run_id> --planner <path> --stage <n>
node .opencode/scripts/build-runner-event-skeleton.js <run_id> <classification_id>
node .opencode/scripts/build-openspec-template.js <run_id> <classification_id>
node .opencode/scripts/build-barrier-preflight.js <run_id> --stage <n> --wave <id>
node .opencode/scripts/build-commit-metadata-summary.js <run_id> <classification_id>
node .opencode/scripts/build-final-report-index.js <run_id> --report <path>
```

Every builder accepts `--check` to print the intended output without writing files.

## Scoped checks

Use scoped checks to avoid validating the whole run artifact tree in every runner or wave.

```bash
node .opencode/scripts/check-verification-matrix.js <run_id>
node .opencode/scripts/check-artifact-freshness.js .opencode/run-artifacts/<run_id> --strict
node .opencode/scripts/check-dispatch-ledger-readiness.js <run_id>
node .opencode/scripts/check-runner-event-completeness.js <run_id> <classification_id>
node .opencode/scripts/check-apply-readiness.js <worktree> <run_id> <classification_id>
node .opencode/scripts/artifact-scope-check.js <run_id> --scope runner --classification <id> --strict
node .opencode/scripts/artifact-scope-check.js <run_id> --scope wave --stage <n> --wave <id> --strict
node .opencode/scripts/artifact-scope-check.js <run_id> --scope final --strict
```

`artifact-scope-check.js` delegates to `artifact-schema-check.js`; it only narrows the target path so runner, wave, and final checks do not repeatedly scan unrelated artifacts.
