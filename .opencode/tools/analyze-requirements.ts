import { access, appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { tool } from "@opencode-ai/plugin"
import {
  DEFAULT_REQUIREMENTS_DIR,
  REQUIREMENT_HISTORY_SUFFIX,
  readRequirementRepoMap,
  resolveRequirementsDir,
  writeRequirementRepoMap,
} from "../lib/requirement-docs"
import type { RequirementRepoMapEntry } from "../lib/requirement-docs"

function normalize(value?: string): string {
  const normalized = typeof value === "string" ? value.trim() : ""
  return normalized.length > 0 ? normalized : "待補"
}

export type AnalyzeRequirementsInput = {
  majorRequirement: string
  targetUsers: string
  constraints: string
  existingSystem: string
  referenceCases: string
  deliverables: string
  extraNotes: string
  mode: string
  relation?: string
  candidateFileName?: string
  diffSummary?: string
  compatibility?: string
  conflictResolution?: string
  versionDecision?: string
  targetFileName?: string
}

function safeTargetFilePath(outputPath: string, targetFileName?: string): string | undefined {
  const normalized = normalize(targetFileName)
  if (normalized === "待補") return undefined

  if (normalized !== path.basename(normalized) || !normalized.toLowerCase().endsWith(".md")) {
    throw new Error("targetFileName 必須是輸出目錄內的 Markdown 檔名")
  }

  return path.join(outputPath, normalized)
}

function buildIterativeUpdate(existingReport: string, nextReport: string, timestamp: string): string {
  return [
    existingReport.trimEnd(),
    "",
    "---",
    `## 迭代更新舊需求（${timestamp}）`,
    "",
    nextReport,
  ].join("\n")
}

const ITERATIVE_COMPACT_THRESHOLD = 60_000

function historyFilePath(filePath: string): string {
  const parsed = path.parse(filePath)
  return path.join(parsed.dir, `${parsed.name}${REQUIREMENT_HISTORY_SUFFIX}`)
}

function buildCompactedIterativeReport(nextReport: string, timestamp: string, archiveFileName: string): string {
  return [
    "# 需求迭代摘要（已壓縮）",
    "",
    "此檔保留最新需求分析供搜尋與維護使用；完整歷史已封存至同目錄歷史檔。",
    "",
    `- **最新更新時間：** ${timestamp}`,
    `- **完整歷史檔：** ${archiveFileName}`,
    "",
    "---",
    "## 最新需求分析",
    "",
    nextReport,
  ].join("\n")
}

async function buildIterativeOutput(filePath: string, nextReport: string, timestamp: string): Promise<{ output: string; archivePath?: string }> {
  const existingReport = await readFile(filePath, "utf-8")
  if (existingReport.length <= ITERATIVE_COMPACT_THRESHOLD) {
    return { output: buildIterativeUpdate(existingReport, nextReport, timestamp) }
  }

  const archivePath = historyFilePath(filePath)
  const archiveBlock = [
    "",
    "---",
    `## 封存需求歷史（${timestamp}）`,
    "",
    existingReport.trimEnd(),
    "",
  ].join("\n")
  await appendFile(archivePath, archiveBlock, "utf-8")

  return {
    output: buildCompactedIterativeReport(nextReport, timestamp, path.basename(archivePath)),
    archivePath,
  }
}

function compactMapValue(value?: string, maxLength = 180): string {
  const normalized = normalize(value).replace(/\s+/g, " ")
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}

function deriveRelation(args: AnalyzeRequirementsInput, hasTargetFile: boolean): string {
  const relation = normalize(args.relation)
  if (["related", "new", "uncertain"].includes(relation.toLowerCase())) return relation.toLowerCase()
  if (relation === "相關") return "related"
  if (relation === "全新") return "new"
  if (relation === "不確定") return "uncertain"
  return hasTargetFile ? "related" : "new"
}

function deriveKeywords(args: AnalyzeRequirementsInput): string {
  const words = [
    args.majorRequirement,
    args.targetUsers,
    args.constraints,
    args.existingSystem,
    args.deliverables,
    args.relation,
    args.candidateFileName,
    args.diffSummary,
    args.compatibility,
    args.conflictResolution,
    args.versionDecision,
    args.extraNotes,
  ]
    .join(" ")
    .split(/[\s,，。；;、:：/\\|()（）\[\]{}<>「」『』"'`]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item !== "待補")

  return [...new Set(words)].slice(0, 18).join("、") || "待補"
}

function deriveCompatibility(args: AnalyzeRequirementsInput): string {
  const compatibility = normalize(args.compatibility).toLowerCase()
  if (["compatible", "conflict", "needs_decision"].includes(compatibility)) return compatibility
  if (compatibility === "相容") return "compatible"
  if (compatibility === "衝突") return "conflict"
  if (compatibility === "需決策" || compatibility === "需要決策") return "needs_decision"
  if (deriveRelation(args, Boolean(args.targetFileName)) === "new") return "compatible"
  return "needs_decision"
}

function deriveVersionDecision(args: AnalyzeRequirementsInput): string {
  const decision = normalize(args.versionDecision).toLowerCase()
  if (["keep_old", "use_new", "merge", "create_new", "needs_decision"].includes(decision)) return decision
  if (decision === "保留舊版") return "keep_old"
  if (decision === "採用新版") return "use_new"
  if (decision === "合併") return "merge"
  if (decision === "建立新需求") return "create_new"
  if (deriveRelation(args, Boolean(args.targetFileName)) === "new") return "create_new"
  return "needs_decision"
}

function displayRelation(value: string): string {
  if (value === "related") return "迭代舊需求"
  if (value === "new") return "全新需求"
  if (value === "uncertain") return "不確定"
  return value || "待補"
}

function displayCompatibility(value: string): string {
  if (value === "compatible") return "相容"
  if (value === "conflict") return "衝突"
  if (value === "needs_decision") return "需決策"
  return value || "待補"
}

function displayVersionDecision(value: string): string {
  if (value === "create_new") return "建立新需求"
  if (value === "use_new") return "採用新版"
  if (value === "merge") return "合併新舊"
  if (value === "keep_old") return "保留舊版"
  if (value === "needs_decision") return "需決策"
  return value || "待補"
}

const ABSTRACT_TERMS = [
  "基本",
  "完整",
  "簡單",
  "方便",
  "清楚",
  "提升效率",
  "管理",
  "整合",
  "支援",
  "提醒",
  "回顧",
  "記錄",
  "分類",
  "彈性",
  "快速",
]

type DetailRule = {
  field: keyof AnalyzeRequirementsInput
  label: string
  minLength: number
  minClauses: number
  requiredPatterns: RegExp[]
  minPatternMatches: number
}

function splitRequirementClauses(value: string): string[] {
  return normalize(value)
    .split(/[，。；;、\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4 && item !== "待補")
}

function countPatternMatches(value: string, patterns: RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(value)).length
}

function isPlaceholder(value: string): boolean {
  const normalized = normalize(value)
  return normalized === "待補" || normalized.includes("待補")
}

function looksLikeAbstractOnly(value: string): boolean {
  const normalized = normalize(value).replace(/[\s，。；;、:：/\\|()（）\[\]{}<>「」『』"'`]+/g, "")
  if (normalized.length >= 28) return false
  return ABSTRACT_TERMS.some((term) => normalized.includes(term))
}

function assertDetailedRequirements(args: AnalyzeRequirementsInput): void {
  const rules: DetailRule[] = [
    {
      field: "majorRequirement",
      label: "主要需求",
      minLength: 30,
      minClauses: 2,
      requiredPatterns: [/問題|痛點|避免|不漏|困擾|需要/, /目標|目的|價值|成功|提升|安排|回顧/, /使用者|情境|場景|時機|第一版/],
      minPatternMatches: 2,
    },
    {
      field: "targetUsers",
      label: "目標使用者",
      minLength: 25,
      minClauses: 2,
      requiredPatterns: [/使用者|角色|個人|管理者|學生|上班族|家庭|團隊/, /頻率|情境|場景|時機|使用|日常|工作|生活/],
      minPatternMatches: 2,
    },
    {
      field: "constraints",
      label: "限制與邊界",
      minLength: 45,
      minClauses: 3,
      requiredPatterns: [
        /必做|包含|第一版|首版|優先|只做|需支援|支援|提供|允許|需要|達成|完成/,
        /不做|不包含|排除|不在|非第一版|非首版|不得|不要|不可|不支援|不同步|不公開|不多人|無公開|無多人|避免公開|略過/,
        /限制|邊界|例外|失敗|風險|隱私|保留|可見|驗收|判準|提示|阻擋|衝突|離線|權限/,
      ],
      minPatternMatches: 3,
    },
    {
      field: "existingSystem",
      label: "既有需求",
      minLength: 6,
      minClauses: 1,
      requiredPatterns: [/無既有|候選|既有|不可覆蓋|舊需求|全新/],
      minPatternMatches: 1,
    },
    {
      field: "referenceCases",
      label: "參考依據",
      minLength: 8,
      minClauses: 1,
      requiredPatterns: [/無外部參考|依本次|參考|案例|依據/],
      minPatternMatches: 1,
    },
    {
      field: "deliverables",
      label: "交付與驗收",
      minLength: 45,
      minClauses: 3,
      requiredPatterns: [/交付|產出|第一版/, /完成|驗收|判準|條件/, /成功|失敗|不交付|非第一版/],
      minPatternMatches: 3,
    },
    {
      field: "extraNotes",
      label: "補充風險與例外",
      minLength: 35,
      minClauses: 2,
      requiredPatterns: [/驗收|成功|完成/, /風險|例外|失敗|衝突/, /待決|後續|版本|優先|取捨|回顧/],
      minPatternMatches: 2,
    },
  ]

  const issues: string[] = []

  for (const rule of rules) {
    const value = normalize(args[rule.field])
    if (isPlaceholder(value)) issues.push(`${rule.label}不可待補`)
    if (value.length < rule.minLength) issues.push(`${rule.label}過短，需補具體情境與判準`)
    if (splitRequirementClauses(value).length < rule.minClauses) issues.push(`${rule.label}需拆成至少 ${rule.minClauses} 個具體決策`)
    if (countPatternMatches(value, rule.requiredPatterns) < rule.minPatternMatches) issues.push(`${rule.label}缺少必要的情境、邊界、例外或驗收語意`)
    if (looksLikeAbstractOnly(value)) issues.push(`${rule.label}仍像功能大類或抽象詞，需再追問定義`)
  }

  if (issues.length > 0) {
    throw new Error(`需求澄清不足，請回到 requirements-clarify 補問後再產檔：${[...new Set(issues)].join("；")}`)
  }
}

function missingCoreFields(args: AnalyzeRequirementsInput, hasTargetFile: boolean): string[] {
  const fields: [string, string | undefined][] = [
    ["majorRequirement", args.majorRequirement],
    ["targetUsers", args.targetUsers],
    ["constraints", args.constraints],
    ["deliverables", args.deliverables],
    ["relation", args.relation],
    ["compatibility", args.compatibility],
    ["versionDecision", args.versionDecision],
  ]

  if (hasTargetFile) {
    fields.push(
      ["candidateFileName", args.candidateFileName],
      ["diffSummary", args.diffSummary],
      ["conflictResolution", args.conflictResolution],
    )
  }

  return fields
    .filter(([, value]) => normalize(value) === "待補")
    .map(([field]) => field)
}

function deriveQuality(args: AnalyzeRequirementsInput, hasTargetFile: boolean): string {
  const issues = missingCoreFields(args, hasTargetFile)
  const relation = deriveRelation(args, hasTargetFile)
  const compatibility = deriveCompatibility(args)
  const versionDecision = deriveVersionDecision(args)

  if (relation === "related" && !hasTargetFile) issues.push("related_without_target")
  if (hasTargetFile && normalize(args.candidateFileName) !== normalize(args.targetFileName)) issues.push("candidate_target_mismatch")
  if (compatibility !== "compatible") issues.push(`compatibility_${compatibility}`)
  if (["needs_decision", "keep_old"].includes(versionDecision)) issues.push(`version_${versionDecision}`)

  return issues.length === 0 ? "ok" : compactMapValue(`issues:${[...new Set(issues)].join("|")}`, 180)
}

function deriveConfidence(args: AnalyzeRequirementsInput, hasTargetFile: boolean): string {
  const relation = deriveRelation(args, hasTargetFile)
  const compatibility = deriveCompatibility(args)
  const versionDecision = deriveVersionDecision(args)
  let score = 40
  const reasons: string[] = []

  if (relation === "related" && hasTargetFile) {
    score += 15
    reasons.push("related_with_target")
  } else if (relation === "new" && !hasTargetFile) {
    score += 15
    reasons.push("new_without_target")
  } else {
    score -= 20
    reasons.push(`relation_${relation}`)
  }

  if (compatibility === "compatible") {
    score += 20
    reasons.push("compatible")
  } else {
    score -= 20
    reasons.push(`compatibility_${compatibility}`)
  }

  if ((hasTargetFile && ["use_new", "merge"].includes(versionDecision)) || (!hasTargetFile && versionDecision === "create_new")) {
    score += 20
    reasons.push(`decision_${versionDecision}`)
  } else {
    score -= 15
    reasons.push(`decision_${versionDecision}`)
  }

  const missing = missingCoreFields(args, hasTargetFile)
  if (missing.length === 0) score += 5
  else {
    score -= Math.min(25, missing.length * 5)
    reasons.push(`missing_${missing.join("+")}`)
  }

  const level = score >= 80 ? "rule_high" : score >= 55 ? "rule_medium" : "rule_low"
  return compactMapValue(`${level}:${Math.max(0, Math.min(100, score))};${reasons.join("|")}`, 160)
}

function extractConflictSections(conflictResolution: string): Map<string, string> {
  const labels = ["保留舊需求", "新版變更", "不衝突原因"]
  const sections = new Map<string, string>()

  labels.forEach((label, index) => {
    const start = conflictResolution.indexOf(label)
    if (start < 0) return
    const nextStarts = labels
      .filter((_, nextIndex) => nextIndex !== index)
      .map((nextLabel) => conflictResolution.indexOf(nextLabel, start + label.length))
      .filter((nextStart) => nextStart > start)
    const end = nextStarts.length > 0 ? Math.min(...nextStarts) : conflictResolution.length
    const value = conflictResolution
      .slice(start + label.length, end)
      .replace(/^[\s：:\-—/、]+/, "")
      .replace(/[\s/、；;，,]+$/, "")
      .trim()
    sections.set(label, value)
  })

  return sections
}

function hasConflictLabels(conflictResolution: string): boolean {
  return ["保留舊需求", "新版變更", "不衝突原因"].every((label) => conflictResolution.includes(label))
}

function isVagueConflictValue(value: string): boolean {
  const normalized = value.trim()
  const vagueTerms = ["已確認", "無衝突", "不影響", "正常", "確認即可", "同上", "如上", "待確認"]
  return normalized.length < 8 || normalized.includes("待補") || vagueTerms.includes(normalized)
}

function buildConflictResolutionFallback(args: AnalyzeRequirementsInput): string {
  const diffSummary = normalize(args.diffSummary)
  const existingSystem = normalize(args.existingSystem)
  const constraints = normalize(args.constraints)
  const majorRequirement = normalize(args.majorRequirement)
  const candidateFileName = normalize(args.candidateFileName)

  const keepOld = existingSystem !== "待補"
    ? `沿用既有需求脈絡與不可改項：${existingSystem}`
    : `沿用候選檔 ${candidateFileName} 中既有需求目標、範圍與驗收脈絡`
  const useNew = diffSummary !== "待補"
    ? `本次新增或調整內容：${diffSummary}`
    : `本次補充 ${majorRequirement} 的需求範圍、限制與驗收判斷`
  const noConflict = constraints !== "待補"
    ? `新舊需求以已確認限制與交付邊界切分：${constraints}；新版只補充本次範圍，不覆蓋既有需求`
    : "新舊需求採同一候選檔延續版本脈絡；新版只補充本次確認的範圍、頻道或驗收差異，不覆蓋既有需求"

  return `保留舊需求：${keepOld}。新版變更：${useNew}。不衝突原因：${noConflict}。`
}

function normalizeConflictResolutionForUpdate(args: AnalyzeRequirementsInput): string {
  const conflictResolution = normalize(args.conflictResolution)
  if (conflictResolution === "待補" || !hasConflictLabels(conflictResolution)) {
    return buildConflictResolutionFallback(args)
  }

  const sections = extractConflictSections(conflictResolution)
  if (["保留舊需求", "新版變更", "不衝突原因"].some((label) => isVagueConflictValue(sections.get(label) || ""))) {
    return buildConflictResolutionFallback(args)
  }

  return conflictResolution
}

function assertConflictResolutionFormat(conflictResolution: string): void {
  const requiredLabels = ["保留舊需求", "新版變更", "不衝突原因"]
  const sections = extractConflictSections(conflictResolution)
  const missing = requiredLabels.filter((label) => {
    const value = sections.get(label) || ""
    return isVagueConflictValue(value)
  })

  if (missing.length > 0) {
    throw new Error(`迭代更新既有需求時 conflictResolution 必須包含三點、每點需具體且不可待補/籠統：${requiredLabels.join("、")}`)
  }

  const uniqueValues = new Set(requiredLabels.map((label) => sections.get(label)))
  if (uniqueValues.size < requiredLabels.length) {
    throw new Error("conflictResolution 三點內容不可重複，需分別說明舊需求保留、新版變更與不衝突原因")
  }

  const keepOld = sections.get("保留舊需求") || ""
  const useNew = sections.get("新版變更") || ""
  const noConflict = sections.get("不衝突原因") || ""
  if (!/(保留|沿用|不變|維持|既有|舊)/.test(keepOld)) {
    throw new Error("conflictResolution 的「保留舊需求」需明確說明哪些舊需求會被保留或沿用")
  }
  if (!/(新增|修改|調整|變更|新版|本次|改為|補充)/.test(useNew)) {
    throw new Error("conflictResolution 的「新版變更」需明確說明本次新增、修改、調整或補充內容")
  }
  if (!/(不衝突|相容|互補|不覆蓋|不取代|邊界|條件|原因|範圍|頻道|測試|切分|隔離|延續)/.test(noConflict)) {
    throw new Error("conflictResolution 的「不衝突原因」需明確說明新舊需求為何相容或如何避免覆蓋")
  }
}

function assertOutputIntent(args: AnalyzeRequirementsInput, targetPath?: string): void {
  assertDetailedRequirements(args)

  const relation = deriveRelation(args, Boolean(targetPath))

  if (relation === "uncertain") {
    throw new Error("relation 為 uncertain 時不可產檔或更新；請先讓使用者確認候選檔或改為 new")
  }

  if (relation === "related" && !targetPath) {
    throw new Error("relation 為 related 時必須提供 targetFileName，避免相關需求被誤建成新檔")
  }

  const compatibility = deriveCompatibility(args)
  const versionDecision = deriveVersionDecision(args)

  if (!targetPath) {
    if (versionDecision !== "create_new") {
      throw new Error("建立新需求檔時 versionDecision 必須是 create_new；保留舊版、採用新版、合併或需決策不可直接建新檔")
    }
    if (compatibility !== "compatible") {
      throw new Error("建立新需求檔前 compatibility 必須是 compatible；若仍有衝突或需決策，請先完成版本確認")
    }
    return
  }

  const diffSummary = normalize(args.diffSummary)
  const conflictResolution = normalizeConflictResolutionForUpdate(args)
  const candidateFileName = normalize(args.candidateFileName)
  const targetFileName = normalize(args.targetFileName)

  if (relation !== "related") {
    throw new Error("只有 relation 為 related 時才可更新既有需求檔")
  }

  if (candidateFileName === "待補") {
    throw new Error("迭代更新既有需求時必須提供 candidateFileName")
  }

  if (candidateFileName !== targetFileName) {
    throw new Error("candidateFileName 必須與 targetFileName 一致，避免更新錯誤舊需求")
  }

  if (diffSummary === "待補") {
    throw new Error("迭代更新既有需求時必須提供 diffSummary，說明新舊需求差異")
  }

  if (compatibility !== "compatible") {
    throw new Error("迭代更新既有需求前，compatibility 必須是 compatible；若有衝突或需決策，請先回到澄清流程")
  }

  if (["keep_old", "create_new", "needs_decision"].includes(versionDecision)) {
    throw new Error("迭代更新既有需求前，versionDecision 必須是 use_new 或 merge；保留舊版、建立新需求或需決策時不可更新舊檔")
  }

  assertConflictResolutionFormat(conflictResolution)
  args.conflictResolution = conflictResolution
}

async function upsertRequirementRepoMap(
  outputPath: string,
  fileName: string,
  args: AnalyzeRequirementsInput,
  updatedAt: string,
  hasTargetFile: boolean,
): Promise<string> {
  const entries = await readRequirementRepoMap(outputPath)
  const nextEntry: RequirementRepoMapEntry = {
    fileName,
    updatedAt,
    relation: deriveRelation(args, hasTargetFile),
    summary: compactMapValue(`${args.majorRequirement}；差異：${normalize(args.diffSummary)}；交付：${args.deliverables}`, 220),
    scope: compactMapValue(`${args.constraints}；候選：${normalize(args.candidateFileName)}；相容性：${deriveCompatibility(args)}；版本決策：${deriveVersionDecision(args)}`, 160),
    latestChange: compactMapValue(`${normalize(args.diffSummary)}；版本決策：${deriveVersionDecision(args)}；衝突處理：${normalize(args.conflictResolution)}`, 180),
    versionDecision: deriveVersionDecision(args),
    source: hasTargetFile ? "iterative_update" : "new_document",
    confidence: deriveConfidence(args, hasTargetFile),
    quality: deriveQuality(args, hasTargetFile),
    keywords: compactMapValue(deriveKeywords(args), 160),
  }
  const nextEntries = [nextEntry, ...entries.filter((entry) => entry.fileName !== fileName)]
  return writeRequirementRepoMap(outputPath, nextEntries)
}

function splitSubRequirements(text: string): string[] {
  const raw = normalize(text)

  if (raw === "待補") {
    return []
  }

  return raw
    .split(/[，；;、\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function buildSubRequirements(primary: string): [string, string, string] {
  const parsed = splitSubRequirements(primary)
  const fallbackBase = [
    `${primary.includes("待補") ? "核心目標" : primary} 的使用者情境與需求入口`,
    `${primary.includes("待補") ? "核心目標" : primary} 的功能範圍、規則與限制`,
    `${primary.includes("待補") ? "核心目標" : primary} 的交付邊界與驗收判斷`,
  ]

  return [
    parsed[0] || fallbackBase[0],
    parsed[1] || fallbackBase[1],
    parsed[2] || fallbackBase[2],
  ]
}

function sectionLine(label: string, value: string): string {
  return `- **${label}：** ${normalize(value)}`
}

function deriveKpi(extraNotes: string, deliverables: string): string {
  const fromExtra = normalize(extraNotes)
  if (fromExtra.includes("成功") || fromExtra.includes("KPI")) {
    return fromExtra
  }

  if (fromExtra.includes("待補")) {
    return `待補。建議以核心情境完成率、使用者回饋、需求覆蓋率與驗收通過率為主要 KPI（待補）`
  }

  if (normalize(deliverables) === "待補") {
    return `待補。建議以主要交付項目完成率、驗收通過率與回饋處理時間為 KPI`
  }

  return `交付《${deliverables}》並滿足已確認的需求目標與驗收條件`
}

function inferMainFlow(majorRequirement: string, targetUsers: string): string {
  const user = targetUsers.includes("待補") ? "目標使用者" : targetUsers
  const goal = majorRequirement.includes("待補") ? "核心需求" : majorRequirement
  return `${user} 進入相關情境 → 觸發或操作 ${goal} → 系統完成處理與回饋 → 使用者確認結果或進入下一步`
}

function buildReferenceSection(referenceCases: string): string {
  if (normalize(referenceCases) !== "待補") {
    return `- **參考依據：** ${referenceCases}\n- **採用判斷：** 僅採用可直接對應本需求目標、使用者情境、限制與交付邊界的做法。`
  }

  return [
    "- **參考依據：** 待補。建議補充競品、既有需求文件、使用者訪談、營運規則或法規依據。",
    "- **採用判斷：** 未補充前，先以需求目標、使用者情境、交付邊界與可驗收性作為通用基準。",
  ].join("\n")
}

function deriveOutOfScope(constraints: string): string {
  const normalized = normalize(constraints)
  if (/(不做|不包含|排除|不在|非第一版|不交付)/.test(normalized)) return normalized
  return "缺少明確排除項；此需求應回到澄清流程補齊不做範圍後再產檔"
}

function buildOpenQuestions(constraints: string, existingSystem: string, referenceCases: string): string[] {
  const questions = [
    constraints.includes("待補") ? "確認本次必做、不做、時程、合規與營運限制" : `確認限制是否完整：${constraints}`,
    existingSystem.includes("待補") ? "確認是否有既有流程、既有規則、角色限制或不可改動項" : `確認既有系統影響：${existingSystem}`,
    referenceCases.includes("待補") ? "確認是否有參考案例、使用者情境或驗收依據" : `確認參考案例採用範圍：${referenceCases}`,
  ]

  return questions.slice(0, 5)
}

function buildReport(args: AnalyzeRequirementsInput) {
  const majorRequirement = normalize(args.majorRequirement)
  const targetUsers = normalize(args.targetUsers)
  const constraints = normalize(args.constraints)
  const existingSystem = normalize(args.existingSystem)
  const referenceCases = normalize(args.referenceCases)
  const deliverables = normalize(args.deliverables)
  const extraNotes = normalize(args.extraNotes)
  const mode = normalize(args.mode)
  const relation = deriveRelation(args, Boolean(args.targetFileName))
  const candidateFileName = normalize(args.candidateFileName)
  const diffSummary = normalize(args.diffSummary)
  const compatibility = deriveCompatibility(args)
  const conflictResolution = normalize(args.conflictResolution)
  const versionDecision = deriveVersionDecision(args)

  const [sr1, sr2, sr3] = buildSubRequirements(majorRequirement)
  const reportHeader = `# 需求分析報告（精簡固定模板）`
  const timestamp = new Date().toISOString()
  const successIndicator = deriveKpi(extraNotes, deliverables)
  const mainFlow = inferMainFlow(majorRequirement, targetUsers)
  const openQuestions = buildOpenQuestions(constraints, existingSystem, referenceCases)

  return `${reportHeader}

## 1. 大需求摘要
${sectionLine("需求編號", "DR-01")}
- **一句話目標：** ${majorRequirement}
- **關聯判斷：** ${relation}（候選檔案：${candidateFileName}）
- **新舊差異：** ${diffSummary}
- **迭代完整性：** ${compatibility}；${conflictResolution}
- **版本決策：** ${versionDecision}
- **成功指標：** ${successIndicator}
- **影響範圍：** ${constraints.includes("待補") ? "待補" : `${constraints}、使用者情境、營運流程、驗收範圍`}

## 2. 需求範圍與交付邊界
### 2.1 需求目標
- **目標：** ${majorRequirement}
- **目標使用者：** ${targetUsers}
- **主要情境：** ${mainFlow}
- **主要價值：** 讓目標使用者在明確情境中完成需求目標，並能用驗收條件確認結果。

### 2.2 交付內容
- **交付範圍：** ${deliverables}
- **不在本次範圍：** ${deriveOutOfScope(constraints)}
- **主要驗收：** 交付內容可對應需求目標、使用者情境與驗收條件。
- **依賴：** ${existingSystem}

### 2.3 限制與前提
- **已知限制：** ${constraints}
- **外部依賴：** ${existingSystem.includes("待補") ? "待補" : existingSystem}
- **決策前提：** 僅依已澄清欄位產出，不新增未確認需求或實作方案。
- **品質風險：** 缺少限制、排除項或驗收資料時，工具應拒絕產檔並回到澄清流程。

## 3. 參考依據與需求判斷
${buildReferenceSection(referenceCases)}
- **通用檢核：** 需求需同時檢查目標一致性、使用者情境、交付邊界、限制條件、相容性與可驗收性。

## 4. 邊緣情境與嚴重程度總覽
### 4.1 風險分級定義
- P0：需求目標無法達成、重大合規風險或核心使用情境完全失效
- P1：主要情境不可完成或大量目標使用者受影響
- P2：局部情境不清、驗收判斷不足或需要人工補充說明
- P3：描述一致性、文件完整性或低影響體驗問題

### 4.2 主要邊緣情境
- 情境名稱：核心流程輸入或前置條件不完整
  - 發生來源：使用者資訊不足、狀態不符、必要條件或需求邊界缺漏
  - 發生機率：高
  - 影響範圍：主要流程無法完成或結果不可信
  - 嚴重程度：P2
  - 建議修復優先度：第二優先
- 情境名稱：既有流程或外部依賴不可用
  - 發生來源：既有流程、外部服務、角色限制或營運規則異常
  - 發生機率：中
  - 影響範圍：交付流程中斷、需求結果不一致或需要人工補救
  - 嚴重程度：P1
  - 建議修復優先度：第一優先
- 情境名稱：狀態、回饋或驗收規則不明確
  - 發生來源：需求邊界不清、文案缺漏、驗收條件未定義
  - 發生機率：高
  - 影響範圍：使用者理解成本、客服/營運成本與需求返工上升
  - 嚴重程度：P2
  - 建議修復優先度：第三優先

## 5. 大需求拆解
### 5.1 大需求：DR-01
- **大需求名稱：** ${majorRequirement}
- **交付邊界：** ${deliverables}
- **關聯成功指標：** ${successIndicator}

### 5.2 子需求 SR-01（使用者情境）
- **子需求名稱：** ${sr1}
- **業務目標：** 明確定義目標使用者、主要情境與完成目標
- **優先順序：** 必做
- **驗收判斷：** 使用者在指定情境中可判斷需求是否完成

### 5.3 子需求 SR-02（範圍規則）
- **子需求名稱：** ${sr2}
- **業務目標：** 明確本次需求必做、不做、限制與相容邊界
- **優先順序：** 必做
- **驗收判斷：** 範圍、規則與限制可被使用者或利害關係人確認

### 5.4 子需求 SR-03（交付驗收）
- **子需求名稱：** ${sr3}
- **業務目標：** 明確交付項、驗收條件與待補決策
- **優先順序：** 應做
- **驗收判斷：** 每個交付項都能對應至少一項驗收條件

## 6. 子需求需求說明
### SR-01（使用者情境）
- **需求說明：** 說明誰在什麼情境下需要完成什麼目標。
- **預期效益：** 降低理解與溝通成本，避免需求落差。
- **邊緣情境與影響分析：** 情境資訊不足時，可能導致驗收標準不一致；嚴重程度 P2。
- **最小可行版本：** 明確目標使用者、主情境與完成定義。
- **延展版本：** 補充次要使用者、例外情境與營運支援需求。
- **依賴與風險：** 使用者角色、情境描述或限制條件未完整定義。
- **替代取捨：** 若情境仍不明確，應先縮小交付範圍並保留待補決策。
- **參考依據：** ${referenceCases.includes("待補") ? "待補" : referenceCases}

### SR-02（範圍規則）
- **需求說明：** 說明本次需求包含哪些規則、限制、依賴與排除項。
- **預期效益：** 降低範圍蔓延與版本衝突風險。
- **邊緣情境與影響分析：** 既有規則與本次變更邊界不清時，可能造成新舊需求互相覆蓋；嚴重程度 P1。
- **最小可行版本：** 明確必做、不做、相容條件與版本決策。
- **延展版本：** 補充跨部門流程、法規限制或營運例外規則。
- **依賴與風險：** 既有系統資訊、營運規則或版本決策不足。
- **替代取捨：** 若與舊需求仍有衝突，應先回到澄清流程，不直接產生新結論。
- **參考依據：** ${existingSystem.includes("待補") ? "待補" : existingSystem}

### SR-03（交付驗收）
- **需求說明：** 說明交付文件、完成條件、驗收標準與待補決策。
- **預期效益：** 讓需求完成與否可被一致判斷。
- **邊緣情境與影響分析：** 驗收條件不足時，可能造成交付後爭議或返工；嚴重程度 P2。
- **最小可行版本：** 每個主要情境都有對應驗收條件。
- **延展版本：** 補充品質門檻、營運檢核與後續迭代條件。
- **依賴與風險：** 交付內容、驗收責任或成功指標未完整定義。
- **替代取捨：** 若驗收標準無法確認，先標記待補，不推測完成條件。
- **參考依據：** ${deliverables}

## 7. 使用者故事（可複製多條）
- **故事編號：** US-01
- **角色：** ${targetUsers.includes("待補") ? "一般使用者" : targetUsers}
- **行為：** 在指定情境中完成「${majorRequirement}」相關操作
- **目的：** 以可理解、可驗證且低返工的方式達成需求目標
- **對應子需求：** SR-01、SR-02、SR-03

## 8. 品質與限制需求
- **可用性：** 主要情境、狀態與下一步行動需清楚可理解
- **一致性：** 新需求需與既有需求、角色限制與營運規則保持相容
- **合規/隱私：** 涉及個資、角色或法規時，需明確標示限制與責任邊界
- **可驗收性：** 每個交付項需有明確成功條件、失敗條件與待補資訊

## 9. 使用流程與回饋草案
- **主流程：** ${mainFlow}
- **關鍵節點：** 需求入口、必要資訊、條件確認、結果回饋、例外處理
- **例外回饋策略：** 告知使用者目前狀態、可採取行動與是否需要人工協助

## 10. 驗收條件（至少 5 項）
- AC-01：使用者可依主流程完成「${majorRequirement}」並取得明確結果
- AC-02：必要資訊缺漏、條件不符或狀態不明時，需有可理解的回饋與下一步
- AC-03：本次交付範圍、不做範圍、限制與依賴均已列明
- AC-04：若是迭代既有需求，新舊差異、相容性與版本決策已清楚記錄
- AC-05：每個主要交付項都可對應使用者情境與驗收判斷

## 11. 里程碑建議
- **最小可行版本：** 完成主情境、核心交付範圍、限制條件與基本驗收
- **試用驗證：** 補齊例外情境、角色限制、相容條件與待補決策
- **正式交付：** 通過驗收、完成風險確認、版本附註與後續迭代條件

---
## 12. 版本附註
- **後續確認清單（3-5 項）：**
${openQuestions.map((question) => `  - ${question}`).join("\n")}
- **需要你確認的關鍵決策：**
  - ${constraints.includes("待補") ? "待補：本次需求的必做/不做與優先順序" : `${constraints} 是否已完整涵蓋本次需求邊界`}

---
輸出時間：${timestamp}
輸出版本：${mode === "final" ? "最終版（含待補清單）" : "初步版本"}`
}

export default tool({
  description: "依深度澄清欄位產生中文需求報告；核心欄位不足、抽象或待補時拒絕產檔。",
  args: {
    majorRequirement: tool.schema.string().describe("需包含問題、價值、主要情境、第一版成功結果；不可只寫需求名稱").default("待補"),
    targetUsers: tool.schema.string().describe("需包含主要使用者、排除或次要使用者、至少兩個使用情境/時機").default("待補"),
    constraints: tool.schema.string().describe("需包含必做/首版只做、不做/排除、優先順序、限制/邊界、例外/失敗情境與驗收語意；不可只列功能大類").default("待補"),
    existingSystem: tool.schema.string().describe("全新需寫無既有需求；迭代需寫候選檔與不可覆蓋項；不可待補").default("待補"),
    referenceCases: tool.schema.string().describe("無參考需明寫無外部參考且依本次澄清內容；不可待補").default("待補"),
    deliverables: tool.schema.string().describe("需包含交付物、第一版/非第一版、完成判準、失敗判準、驗收方式").default("待補"),
    extraNotes: tool.schema.string().describe("需包含驗收重點、風險、例外、待決/後續版本取捨").default("待補"),
    mode: tool.schema.string().describe("initial 或 final").default("initial"),
    relation: tool.schema
      .string()
      .describe("related/new/uncertain")
      .default(""),
    candidateFileName: tool.schema
      .string()
      .describe("候選舊檔名")
      .default(""),
    diffSummary: tool.schema
      .string()
      .describe("新舊差異")
      .default(""),
    compatibility: tool.schema
      .string()
      .describe("compatible/conflict/needs_decision")
      .default(""),
    conflictResolution: tool.schema
      .string()
      .describe("迭代需含：保留舊需求、新版變更、不衝突原因")
      .default(""),
    versionDecision: tool.schema
      .string()
      .describe("keep_old/use_new/merge/create_new/needs_decision")
      .default(""),
    targetFileName: tool.schema
      .string()
      .describe("related 時等於 candidateFileName")
      .default(""),
  },
  async execute(args, context) {
    const safeWorktree = context?.worktree ? context.worktree : process.cwd()
    const { filePath, repoMapPath, archivePath } = await writeAnalyzeRequirementsOutput(args, safeWorktree)
    const relation = deriveRelation(args, Boolean(args.targetFileName))
    const versionDecision = deriveVersionDecision(args)
    const compatibility = deriveCompatibility(args)

    return [
      "需求分析文件已產生。",
      `- 檔案：${filePath}`,
      `- 索引：${repoMapPath}`,
      archivePath ? `- 歷史備份：${archivePath}` : "",
      `- 關係：${displayRelation(relation)}`,
      `- 版本決策：${displayVersionDecision(versionDecision)}`,
      `- 相容性：${displayCompatibility(compatibility)}`,
    ].filter(Boolean).join("\n")
  },
})

async function writeAnalyzeRequirementsOutput(
  args: AnalyzeRequirementsInput,
  worktree: string,
  outputDir?: string,
): Promise<{ filePath: string; repoMapPath: string; archivePath?: string }> {
  const safeWorktree = worktree || process.cwd()
  const outputPath = resolveRequirementsDir(safeWorktree, outputDir || DEFAULT_REQUIREMENTS_DIR)
  const targetPath = safeTargetFilePath(outputPath, args.targetFileName)
  assertOutputIntent(args, targetPath)

  const filePath = targetPath || path.join(outputPath, `analyze-requirements_${randomUUID()}_${Date.now()}.md`)
  const timestamp = new Date().toISOString()

  await mkdir(outputPath, { recursive: true })
  if (targetPath) await access(targetPath)

  const report = buildReport(args)
  const iterativeResult = targetPath ? await buildIterativeOutput(targetPath, report, timestamp) : { output: report }
  const output = iterativeResult.output
  await writeFile(filePath, output, "utf-8")
  const repoMapPath = await upsertRequirementRepoMap(outputPath, path.basename(filePath), args, timestamp, Boolean(targetPath))

  return { filePath, repoMapPath, archivePath: iterativeResult.archivePath }
}
