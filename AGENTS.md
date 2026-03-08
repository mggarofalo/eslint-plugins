# ESLint Plugins Monorepo

## Prerequisites

- Node.js 22+
- npm (comes with Node.js)

## Build & Test

```bash
# Install dependencies (from repo root)
npm ci

# Build all packages
npm run build

# Test all packages
npm test

# Build/test a specific package
npm run build -w packages/eslint-plugin-react-hook-stability
npm test -w packages/eslint-plugin-react-hook-stability
```

## Branching Strategy

- `main` — stable, always passing CI
- Feature branches — `feat/<description>` or `fix/<description>`
- PRs target `main`; squash-merge preferred

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — maintenance (deps, CI, config)
- `docs:` — documentation only
- `test:` — adding or updating tests
- `refactor:` — code change that neither fixes a bug nor adds a feature

Scope to the package when relevant: `feat(react-hook-stability): add new rule`

## Coding Standards

- **TypeScript** with `strict: true`
- **ESM only** (`"type": "module"`)
- **Vitest** for testing
- **ESLint 9** flat config (the plugins target ESLint 9+)
- 2-space indentation, LF line endings

## Adding a New Package

1. Create `packages/<package-name>/` with `package.json`, `tsconfig.json`, `src/`, `tests/`
2. Scope the package: `@mggarofalo/<package-name>`
3. Add the package name to the CI/publish workflow matrices in `.github/workflows/`
4. Run `npm install` from the repo root to link the workspace
