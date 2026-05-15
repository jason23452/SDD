const path = require("node:path")
const {
  ALLOWED_ARTIFACT_STATUSES,
  BLOCKING_ARTIFACT_STATUSES,
  COMMON_SUMMARY_FIELDS,
  DISPATCH_LEDGER_SET_ARRAY_FIELDS,
  DISPATCH_LEDGER_SET_FIELDS,
  DISPATCH_LEDGER_STAGE_ARRAY_FIELDS,
  DISPATCH_LEDGER_STAGE_FIELDS,
  DISPATCH_LEDGER_TOP_FIELDS,
  DISPATCH_LEDGER_WAVE_FIELDS,
  DISPATCH_LEDGER_WORKTREE_FIELDS,
  RUNNER_EVENT_COMMIT_FIELDS,
  RUNNER_EVENT_FIELDS,
} = require("./artifact-schema-rules")
const { ROOT } = require("./artifact-utils")

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/")
}

function hasAny(obj, keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(obj, key))
}

function requireField(file, obj, field, code, addFinding, message) {
  if (!Object.prototype.hasOwnProperty.call(obj, field)) {
    addFinding("error", code, rel(file), message || `Missing required field: ${field}`)
    return false
  }
  return true
}

function requireArray(file, obj, field, code, addFinding) {
  if (!requireField(file, obj, field, code, addFinding, `Missing required array field: ${field}`)) return
  if (!Array.isArray(obj[field])) addFinding("error", code, rel(file), `${field} must be an array.`)
}

function validateCommonFields(file, data, addFinding) {
  for (const field of COMMON_SUMMARY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) {
      addFinding("error", "SUMMARY_FIELD_MISSING", rel(file), `Missing required field: ${field}`)
    }
  }

  if (!hasAny(data, ["sourceRefs", "sourceRef", "source"])) {
    addFinding("error", "SOURCE_REFS_MISSING", rel(file), "Missing sourceRefs/sourceRef/source.")
  }

  if (!hasAny(data, ["sourceHashes", "sourceHash", "sourceHead", "head", "HEAD"])) {
    addFinding("error", "SOURCE_HASH_MISSING", rel(file), "Missing sourceHashes/sourceHash/sourceHead/head.")
  }

  if (Object.prototype.hasOwnProperty.call(data, "blockers") && !Array.isArray(data.blockers)) {
    addFinding("error", "BLOCKERS_NOT_ARRAY", rel(file), "blockers must be an array.")
  }

  if (Object.prototype.hasOwnProperty.call(data, "detailRefs") && !Array.isArray(data.detailRefs)) {
    addFinding("error", "DETAIL_REFS_NOT_ARRAY", rel(file), "detailRefs must be an array.")
  }

  if (Object.prototype.hasOwnProperty.call(data, "sourceRefs") && !Array.isArray(data.sourceRefs) && typeof data.sourceRefs !== "object") {
    addFinding("error", "SOURCE_REFS_NOT_ARRAY", rel(file), "sourceRefs must be an array or object when present.")
  }

  if (Object.prototype.hasOwnProperty.call(data, "fallbackAction") && typeof data.fallbackAction !== "string") {
    addFinding("error", "FALLBACK_ACTION_INVALID", rel(file), "fallbackAction must be a string.")
  }

  if (typeof data.fallbackAction === "string" && data.fallbackAction.trim() === "") {
    addFinding("error", "FALLBACK_ACTION_EMPTY", rel(file), "fallbackAction must not be empty.")
  }

  if (typeof data.status === "string" && !ALLOWED_ARTIFACT_STATUSES.has(data.status)) {
    addFinding("warning", "STATUS_UNKNOWN", rel(file), `Unknown status value: ${data.status}`)
  }

  if (!hasAny(data, ["createdAt", "updatedAt", "created_at", "updated_at", "scanTimestamp"])) {
    addFinding("warning", "TIMESTAMP_MISSING", rel(file), "Missing createdAt/updatedAt or equivalent timestamp.")
  }

  if (BLOCKING_ARTIFACT_STATUSES.has(data.status) && Array.isArray(data.blockers) && data.blockers.length === 0) {
    addFinding("warning", "BLOCKED_WITHOUT_BLOCKERS", rel(file), `status=${data.status} but blockers[] is empty.`)
  }
}

function validateDispatchLedger(file, data, addFinding) {
  for (const field of DISPATCH_LEDGER_TOP_FIELDS) {
    requireField(file, data, field, "DISPATCH_LEDGER_FIELD_MISSING", addFinding)
  }
  requireArray(file, data, "stages", "DISPATCH_LEDGER_STAGES_INVALID", addFinding)

  if (!Array.isArray(data.stages)) return
  data.stages.forEach((stage, stageIndex) => {
    const prefix = `stages[${stageIndex}]`
    for (const field of DISPATCH_LEDGER_STAGE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(stage, field)) addFinding("error", "DISPATCH_LEDGER_STAGE_FIELD_MISSING", rel(file), `${prefix}.${field} is missing.`)
    }
    for (const field of DISPATCH_LEDGER_STAGE_ARRAY_FIELDS) {
      if (!Array.isArray(stage[field])) addFinding("error", "DISPATCH_LEDGER_STAGE_ARRAY_INVALID", rel(file), `${prefix}.${field} must be an array.`)
    }

    if (Array.isArray(stage.readyWaves)) {
      stage.readyWaves.forEach((wave, waveIndex) => {
        for (const field of DISPATCH_LEDGER_WAVE_FIELDS) {
          if (!Object.prototype.hasOwnProperty.call(wave, field)) addFinding("error", "DISPATCH_LEDGER_WAVE_FIELD_MISSING", rel(file), `${prefix}.readyWaves[${waveIndex}].${field} is missing.`)
        }
      })
    }

    if (Array.isArray(stage.eligibleSets)) {
      stage.eligibleSets.forEach((set, setIndex) => {
        for (const field of DISPATCH_LEDGER_SET_FIELDS) {
          if (!Object.prototype.hasOwnProperty.call(set, field)) addFinding("error", "DISPATCH_LEDGER_SET_FIELD_MISSING", rel(file), `${prefix}.eligibleSets[${setIndex}].${field} is missing.`)
        }
        for (const field of DISPATCH_LEDGER_SET_ARRAY_FIELDS) {
          if (Object.prototype.hasOwnProperty.call(set, field) && !Array.isArray(set[field])) addFinding("error", "DISPATCH_LEDGER_SET_ARRAY_INVALID", rel(file), `${prefix}.eligibleSets[${setIndex}].${field} must be an array.`)
        }
        if (Array.isArray(set.expectedWorktrees)) {
          set.expectedWorktrees.forEach((worktree, worktreeIndex) => {
            for (const field of DISPATCH_LEDGER_WORKTREE_FIELDS) {
              if (!Object.prototype.hasOwnProperty.call(worktree, field)) addFinding("error", "DISPATCH_LEDGER_WORKTREE_FIELD_MISSING", rel(file), `${prefix}.eligibleSets[${setIndex}].expectedWorktrees[${worktreeIndex}].${field} is missing.`)
            }
            if (typeof worktree.branch === "string" && !worktree.branch.startsWith(`worktree/${data.run_id}/`)) {
              addFinding("error", "WORKTREE_BRANCH_NAMESPACE_INVALID", rel(file), `${prefix}.eligibleSets[${setIndex}].expectedWorktrees[${worktreeIndex}].branch is not worktree/<run_id>/*.`)
            }
          })
        }
      })
    }
  })
}

function validateRunnerEvent(file, data, addFinding) {
  for (const field of RUNNER_EVENT_FIELDS) {
    requireField(file, data, field, "RUNNER_EVENT_FIELD_MISSING", addFinding)
  }
  if (data.commits && typeof data.commits === "object") {
    for (const field of RUNNER_EVENT_COMMIT_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(data.commits, field)) addFinding("error", "RUNNER_EVENT_COMMITS_FIELD_MISSING", rel(file), `commits.${field} is missing.`)
    }
  }
  if (data.verification && typeof data.verification === "object" && !Object.prototype.hasOwnProperty.call(data.verification, "local")) {
    addFinding("error", "RUNNER_EVENT_VERIFICATION_LOCAL_MISSING", rel(file), "verification.local is missing.")
  }
  if (typeof data.branch === "string" && data.run_id && !data.branch.startsWith(`worktree/${data.run_id}/`)) {
    addFinding("error", "WORKTREE_BRANCH_NAMESPACE_INVALID", rel(file), "runner event branch is not worktree/<run_id>/*.")
  }
}

function validateFinalReportIndex(file, data, addFinding) {
  requireArray(file, data, "commitMap", "FINAL_REPORT_INDEX_COMMIT_MAP_INVALID", addFinding)
  if (!Array.isArray(data.commitMap)) return

  const seen = new Set()
  data.commitMap.forEach((commit, index) => {
    const prefix = `commitMap[${index}]`
    if (!commit || typeof commit !== "object" || Array.isArray(commit)) {
      addFinding("error", "FINAL_REPORT_INDEX_COMMIT_ROW_INVALID", rel(file), `${prefix} must be an object.`)
      return
    }
    if (typeof commit.hash !== "string" || commit.hash.trim() === "") {
      addFinding("error", "FINAL_REPORT_INDEX_COMMIT_HASH_MISSING", rel(file), `${prefix}.hash is required as the canonical commit id.`)
      return
    }
    if (seen.has(commit.hash)) addFinding("error", "FINAL_REPORT_INDEX_COMMIT_HASH_DUPLICATE", rel(file), `${prefix}.hash duplicates another commit map row.`)
    seen.add(commit.hash)
    if (commit.run_id !== data.run_id) addFinding("error", "FINAL_REPORT_INDEX_COMMIT_RUN_ID_MISMATCH", rel(file), `${prefix}.run_id must match final-report-index run_id.`)
    if (typeof commit.classificationId !== "string" || commit.classificationId.trim() === "") addFinding("error", "FINAL_REPORT_INDEX_COMMIT_CLASSIFICATION_MISSING", rel(file), `${prefix}.classificationId is required.`)
  })

  if (data.commitMapByHash !== undefined) {
    if (!data.commitMapByHash || typeof data.commitMapByHash !== "object" || Array.isArray(data.commitMapByHash)) {
      addFinding("error", "FINAL_REPORT_INDEX_BY_HASH_INVALID", rel(file), "commitMapByHash must be an object when present.")
      return
    }
    for (const [hash, commit] of Object.entries(data.commitMapByHash)) {
      if (!seen.has(hash)) addFinding("error", "FINAL_REPORT_INDEX_BY_HASH_UNKNOWN", rel(file), `commitMapByHash.${hash} does not point to a commitMap[].hash row.`)
      if (!commit || typeof commit !== "object" || commit.hash !== hash) addFinding("error", "FINAL_REPORT_INDEX_BY_HASH_MISMATCH", rel(file), `commitMapByHash.${hash}.hash must equal the object key.`)
    }
  }

  if (data.commitHashes !== undefined) {
    if (!Array.isArray(data.commitHashes)) addFinding("error", "FINAL_REPORT_INDEX_COMMIT_HASHES_INVALID", rel(file), "commitHashes must be an array when present.")
    else for (const hash of data.commitHashes) if (!seen.has(hash)) addFinding("error", "FINAL_REPORT_INDEX_COMMIT_HASHES_UNKNOWN", rel(file), `commitHashes contains unknown hash: ${hash}`)
  }
}

module.exports = {
  validateFinalReportIndex,
  validateCommonFields,
  validateDispatchLedger,
  validateRunnerEvent,
}
