# eslint-plugins

Monorepo for ESLint plugins by [@mggarofalo](https://github.com/mggarofalo).

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@mggarofalo/eslint-plugin-react-hook-stability](./packages/eslint-plugin-react-hook-stability) | [![npm](https://img.shields.io/npm/v/@mggarofalo/eslint-plugin-react-hook-stability)](https://www.npmjs.com/package/@mggarofalo/eslint-plugin-react-hook-stability) | Detect unstable references returned from React hooks |

## Development

```bash
npm ci
npm run build
npm test
```

## Releasing

```bash
./scripts/release.sh <package-short-name> <version>
# Example: ./scripts/release.sh react-hook-stability 0.2.0
```

See [AGENTS.md](./AGENTS.md) for full conventions.
