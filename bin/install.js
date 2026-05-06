#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")

const packageRoot = path.resolve(__dirname, "..")

const copyEntries = [
  [".opencode/agents", ".opencode/agents"],
  [".opencode/lib", ".opencode/lib"],
  [".opencode/tools", ".opencode/tools"],
  [".opencode/package.json", ".opencode/package.json"],
  [".opencode/package-lock.json", ".opencode/package-lock.json"],
  [".opencode/bun.lock", ".opencode/bun.lock"],
  [".opencode/.gitignore", ".opencode/.gitignore"],
  ["FLOW_1.md", "FLOW_1.md"],
]

function usage() {
  return [
    "Usage:",
    "  sdd-opencode-flow [target-dir] [--force]",
    "",
    "Examples:",
    "  npx git+https://github.com/jason23452/SDD.git",
    "  npx git+https://github.com/jason23452/SDD.git ./my-project",
    "  npx git+https://github.com/jason23452/SDD.git -- --force",
    "",
    "Read FLOW_1.md for the workflow details.",
  ].join("\n")
}

function parseArgs(argv) {
  let targetDir = process.cwd()
  let force = false

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(usage())
      process.exit(0)
    }

    if (arg === "--force") {
      force = true
      continue
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`)
    }

    targetDir = path.resolve(process.cwd(), arg)
  }

  return { targetDir, force }
}

function walkFiles(sourcePath, relativePath = "") {
  const stat = fs.statSync(sourcePath)

  if (stat.isFile()) {
    return [{ sourcePath, relativePath }]
  }

  if (!stat.isDirectory()) {
    return []
  }

  return fs.readdirSync(sourcePath).flatMap((entry) => {
    const nextSource = path.join(sourcePath, entry)
    const nextRelative = path.join(relativePath, entry)
    return walkFiles(nextSource, nextRelative)
  })
}

function plannedCopies() {
  return copyEntries.flatMap(([sourceRelative, targetRelative]) => {
    const sourcePath = path.join(packageRoot, sourceRelative)

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Package is missing required source: ${sourceRelative}`)
    }

    const stat = fs.statSync(sourcePath)

    if (stat.isFile()) {
      return [{
        sourcePath,
        targetPath: path.join(targetRelative),
      }]
    }

    return walkFiles(sourcePath).map((file) => ({
      sourcePath: file.sourcePath,
      targetPath: path.join(targetRelative, file.relativePath),
    }))
  })
}

function copyFile(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.copyFileSync(sourcePath, targetPath)
}

function main() {
  const { targetDir, force } = parseArgs(process.argv.slice(2))
  const copies = plannedCopies()
  const conflicts = copies
    .map((item) => path.join(targetDir, item.targetPath))
    .filter((targetPath) => fs.existsSync(targetPath))

  if (conflicts.length > 0 && !force) {
    console.error("Install aborted because these files already exist:")
    for (const conflict of conflicts) {
      console.error(`- ${path.relative(targetDir, conflict)}`)
    }
    console.error("")
    console.error("Re-run with --force to overwrite existing workflow files.")
    process.exit(1)
  }

  fs.mkdirSync(targetDir, { recursive: true })

  for (const item of copies) {
    copyFile(item.sourcePath, path.join(targetDir, item.targetPath))
  }

  fs.mkdirSync(path.join(targetDir, ".opencode", "outputs", "analyze-requirements"), { recursive: true })
  fs.mkdirSync(path.join(targetDir, ".opencode", "commands"), { recursive: true })
  fs.mkdirSync(path.join(targetDir, ".opencode", "skills"), { recursive: true })

  console.log("Installed .opencode requirements workflow.")
  console.log(`Target: ${targetDir}`)
  console.log("Read FLOW_1.md for the workflow details.")
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
