const path = require("node:path")

const { ROOT, readText, rel, sha256File, walkFiles } = require("./artifact-utils")

function stripWrappingQuotes(value) {
  if (!value) return value
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1)
  return value
}

function parseScalar(value, lines, indexRef) {
  const trimmed = value.trim()
  if (trimmed === ">" || trimmed === ">-" || trimmed === "|" || trimmed === "|-") {
    const block = []
    while (indexRef.index + 1 < lines.length) {
      const next = lines[indexRef.index + 1]
      if (!/^\s+/.test(next)) break
      indexRef.index += 1
      block.push(next.trim())
    }
    return block.join(" ").trim()
  }
  return stripWrappingQuotes(trimmed)
}

function parseFrontmatter(text) {
  if (!text.startsWith("---\n") && text !== "---") return {}
  const lines = text.split(/\r?\n/)
  if (lines[0].trim() !== "---") return {}
  const data = {}
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === "---") break
    if (!line.trim() || line.trim().startsWith("#")) continue
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    const indexRef = { index }
    data[key] = parseScalar(rawValue, lines, indexRef)
    index = indexRef.index
  }
  return data
}

function discoverSkills(options = {}) {
  const root = options.root || ROOT
  const skillsDir = options.skillsDir || path.join(root, ".opencode", "skills")
  const files = walkFiles(skillsDir).filter((file) => path.basename(file) === "SKILL.md")
  return files.map((file) => {
    const text = readText(file)
    const frontmatter = parseFrontmatter(text)
    const relativePath = rel(file)
    const folderName = path.basename(path.dirname(file))
    return {
      name: frontmatter.name || folderName,
      description: frontmatter.description || "",
      metadata: frontmatter.metadata || null,
      path: relativePath,
      absolutePath: file,
      folderName,
      relativeDir: path.dirname(relativePath).replace(/\\/g, "/"),
      sha256: sha256File(file),
      source: "workspace-skill-scan",
    }
  })
}

function findSkillByName(skills, name) {
  return skills.find((skill) => skill.name === name) || null
}

module.exports = {
  discoverSkills,
  findSkillByName,
  parseFrontmatter,
}
