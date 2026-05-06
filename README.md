# SDD .opencode Workflow

Install this workflow directly with `npx` from Git. It does not need to be published to the npm registry.

```powershell
npx git+https://github.com/jason23452/SDD.git
```

Install into another directory:

```powershell
npx git+https://github.com/jason23452/SDD.git ./my-project
```

Overwrite existing workflow files:

```powershell
npx git+https://github.com/jason23452/SDD.git -- --force
```

The installer copies:

- `.opencode/agents`
- `.opencode/tools`
- `.opencode/lib`
- `.opencode/package.json`
- `.opencode/package-lock.json`
- `.opencode/bun.lock`
- `.opencode/.gitignore`
- `FLOW_1.md`

For the workflow design and architecture diagrams, read [FLOW_1.md](./FLOW_1.md).
