# OpenCode validation scripts

These scripts are one-shot helpers for validation and deterministic run-artifact generation. Writer scripts only write `.opencode/run-artifacts/<run_id>/**`, support `--check` dry-run, and never commit, merge, clean worktrees, stop processes, install packages, or change runtime state.

## Agent rules

Run after editing `.opencode/agents/*.md` or `.opencode/scripts/*.js`:

```bash
node .opencode/scripts/agent-contract-check.js --strict
node .opencode/scripts/test-checkers.js
npm --prefix .opencode run verify:contracts
```

`agent-contract-check.js` validates the canonical artifact registry, compact output fields, alias namespace blockers, stale placeholders, and immutable skill diffs.

`check-repo-preflight.js --strict` is the top-level repository guard used by `verify:contracts`. It runs agent/script contract checks, verifies `.opencode/package.json` and `.opencode/package-lock.json` remain trackable, blocks staged runtime artifacts under `.opencode/run-artifacts` except maintained final reports, and blocks dirty `.opencode/skills` diffs.

## Run artifacts

Run when a concrete run artifact directory exists:

```bash
node .opencode/scripts/artifact-schema-check.js .opencode/run-artifacts/<run_id> --strict
node .opencode/scripts/artifact-schema-check.js --legacy-report --legacy-summary-only --report-only
```

`artifact-schema-check.js` validates summary/index/lock/packet common fields, `dispatch-ledger/v1`, `runner-event/v1`, source refs/hashes, fallback actions, status values, and `worktree/<run_id>/*` branch namespace.

Useful options:

- `--legacy-report`: include legacy drift counts grouped by finding code.
- `--legacy-summary-only`: suppress detailed findings while keeping legacy summary counts.
- `--max-findings <n>`: cap detailed findings in text/JSON output.
- `--by-file`: include per-file finding counts.
- `--report-only`: return exit code 0 even when findings fail the schema check.

Compact flow artifacts such as `run-preflight-packet/v1`, `skill-driven-verification-contract/v1`, `verification-matrix/v1`, `package-decision-record/v1`, `experience-contract/v1`, and `context-slice/v1` are treated as summary artifacts. They must include common source refs, source hashes, status, blockers, detail refs, and fallback actions; they never replace the full planner, project rules, dispatch ledger, runner events, or final maintained report.

Speed artifacts such as `openspec-template-contract/v1`, `apply-readiness-checklist/v1`, `snapshot-manifest/v1`, and `commit-metadata-summary/v1` follow the same common summary contract. They optimize formatting, snapshot sync, apply readiness checks, and final report generation, but stale or blocked summaries must fall back to the original OpenSpec artifacts, source worktree files, or git history.

If `.opencode/run-artifacts` does not exist, the checker reports `skipped`; this is expected outside an active run.

Use `normalize-legacy-artifacts.js` to inspect or repair old artifact directories. It defaults to dry-run mode and only writes when `--apply` is present:

```bash
node .opencode/scripts/normalize-legacy-artifacts.js .opencode/run-artifacts/<run_id> --json
node .opencode/scripts/normalize-legacy-artifacts.js .opencode/run-artifacts/<run_id> --apply
```

Use `cleanup-test-artifacts.js` to remove generated `run-test-*` artifacts. `--check` is dry-run, and `--older-than-minutes <n>` keeps newer test runs for debugging.

```bash
node .opencode/scripts/cleanup-test-artifacts.js --check --older-than-minutes 5
```

## Speed artifact builders

Use these after planner/classification decisions exist to reduce repeated long-context reads. All generated artifacts are summaries only; stale, blocked, missing, or hash-mismatched artifacts must fall back to the full source gate.

```bash
node .opencode/scripts/build-run-preflight-packet.js <run_id> --planner <path>
node .opencode/scripts/build-active-skill-selection-contract.js <run_id> --planner <path>
node .opencode/scripts/build-skill-driven-verification-contract.js <run_id> --planner <path>
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
node .opencode/scripts/build-run-metrics-summary.js <run_id>
node .opencode/scripts/build-resume-cursor.js <run_id>
node .opencode/scripts/build-verification-summary.js <run_id> --scope <scope> --check-id <id> --status <status>
```

Every builder accepts `--check` to print the intended output without writing files, `--json` to emit the shared script result format, `--out <path>` to override the output file, and `--strict` to exit non-zero when the generated artifact is blocked/stale/missing/failed.

`build-commit-metadata-summary.js` also supports `--runner-event <path>`, `--from <commit>`, `--to <commit>`, and `--commits <hashes>` so final report and bugfix indexes can be generated from exact runner commits instead of scanning recent history.

`build-active-skill-selection-contract.js` resolves the active skill set only from an explicit planner `Active Skills` or `Active Skill Adoption` section matched against `skill-lock`. `build-skill-driven-verification-contract.js` then reads that selection plus `project-rules-lock` and active `SKILL.md` files to build the structured verification authority. Planner verification sections are supplemental only. `build-verification-matrix.js` must read that contract instead of inferring tools.

## Scoped checks

Use scoped checks to avoid validating the whole run artifact tree in every runner or wave.

```bash
node .opencode/scripts/check-verification-matrix.js <run_id>
node .opencode/scripts/check-artifact-freshness.js .opencode/run-artifacts/<run_id> --strict --gate runner
node .opencode/scripts/check-artifact-crossrefs.js <run_id> --strict
node .opencode/scripts/check-script-contracts.js
node .opencode/scripts/check-repo-preflight.js --strict
node .opencode/scripts/check-dispatch-ledger-readiness.js <run_id>
node .opencode/scripts/check-runner-event-completeness.js <run_id> <classification_id>
node .opencode/scripts/check-resume-readiness.js <run_id> --strict
node .opencode/scripts/check-runtime-artifacts-clean.js --strict
node .opencode/scripts/check-apply-readiness.js <worktree> <run_id> <classification_id>
node .opencode/scripts/artifact-scope-check.js <run_id> --scope runner --classification <id> --strict
node .opencode/scripts/artifact-scope-check.js <run_id> --scope wave --stage <n> --wave <id> --strict
node .opencode/scripts/artifact-scope-check.js <run_id> --scope final --strict
```

`artifact-scope-check.js` delegates to `artifact-schema-check.js`; it only narrows the target path so runner, wave, and final checks do not repeatedly scan unrelated artifacts.

`build-context-slices.js`, `build-port-map.js`, and `build-runner-event-skeleton.js` are ledger-aware. If the dispatch ledger is missing or has no matching expected worktrees, they emit blocked summaries instead of placeholder passing artifacts.

`check-artifact-freshness.js --strict` fails blocked/stale/failed/missing summaries, stale source hashes, HEAD mismatches, missing `requiredFor` on source refs, missing detail refs, and missing fallback actions on summary artifacts. Add `--gate runner|merge|final` when a gate needs usable summaries; planned artifacts fail in gate mode. `check-verification-matrix.js` fails empty matrices so runners cannot treat an empty matrix as "no verification needed".

`check-artifact-crossrefs.js` validates cross-artifact consistency between dispatch ledger, context slices, runner event refs, branch/eligibleSet alignment, port owners, and run-level package/experience/verification artifacts. `check-script-contracts.js` validates script safety contracts such as `--check` support for builders, run-artifact output scope, no git mutation commands, no PowerShell lifecycle commands, no `.worktree` writes, and no skill writes.

`check-dispatch-ledger-readiness.js` validates nested stage/wave/eligibleSet/worktree fields, duplicate classifications/branches, runner event path presence, and branch namespace. `check-runner-event-completeness.js` validates completed runner events have `specCommit`, local verification evidence, and no error; failed/blocked runner events must include an error object.

`check-artifact-crossrefs.js` also checks completed runner events have commit metadata summaries, commit metadata hashes exist in git, final-report-index covers commit summaries, and verification summaries cover verification-matrix check IDs when present.

`build-planner-index.js` stores section ranges, section hashes, keyword index, and package/experience/verification section refs. `build-final-report-index.js` stores file-to-commit, classification-to-commit, and keyword-to-commit maps for lower-token bugfix lookup.

`build-run-metrics-summary.js` summarizes artifact status/schema counts, fallback risk count, and summary hit-rate proxy for speed/token tuning. `build-resume-cursor.js` and `check-resume-readiness.js` identify the next non-completed worktree from the dispatch ledger and validate cursor freshness. `build-verification-summary.js` creates compact check summaries with log refs. `check-runtime-artifacts-clean.js` prevents runtime run-artifacts from being staged, except the final maintained `final-merge-report.md`.

## NPM scripts

Run npm scripts from `.opencode` directly, or use `npm --prefix .opencode run <script>` from the repository root.

```bash
npm run check:agents
npm run check:scripts
npm run check:repo-preflight
npm run check:artifacts
npm run test:checkers
npm run verify
npm run verify:artifacts
npm run verify:all
```

`verify` is intentionally fast and aliases `verify:contracts`. `verify:all` runs contract checks plus artifact schema reporting with legacy-compatible report-only mode.
