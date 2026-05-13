# OpenCode validation scripts

These scripts are one-shot, read-only checks. They do not modify files, commit, merge, clean worktrees, stop processes, or change runtime state.

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

If `.opencode/run-artifacts` does not exist, the checker reports `skipped`; this is expected outside an active run.
