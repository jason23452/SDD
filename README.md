# SDD .opencode User Story Workflow

Install this image-to-User-Story workflow directly with `npx` from Git. It does not need to be published to the npm registry.

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
- `.opencode/opencode.json`
- `.opencode/package.json`
- `.opencode/package-lock.json`
- `.opencode/bun.lock`
- `FLOW_1.md`

It also creates `.opencode/.gitignore` during installation.

The default agent is `userstory`. It creates `.opencode/outputs/userstory/<run_id>/`, writes a dynamic `draft.html`, asks for confirmation, then produces `userstory.md` and `final.html` after approval.

For the workflow design and architecture diagrams, read [FLOW_1.md](./FLOW_1.md).
