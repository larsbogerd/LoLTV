# anti-slop (vendored)

Oxlint rules copied into this repo by the `install-anti-slop` agent skill. This copy is owned
here: local changes are allowed, and the skill's update procedure preserves them.

- **Source:** https://github.com/dmmulroy/anti-slop, installed through its
  `skills/install-anti-slop` skill (`assets/anti-slop`).
- **Source revision:** unknown. The skill was installed without a recorded commit. The only
  identifier is the skill hash in `skills-lock.json`:
  `1b9b5d3c0d9e0ef8dd7631f4d637e66b62a73e34dceaf4ae07c0d3de376fd7d7`.
- **Installed:** 2026-10-24, into `tools/oxlint/anti-slop/` (the default path), unmodified.
- **Dependencies:** `oxlint` and `@oxlint/plugins`, both pinned at exactly 1.89.0.
- **Configuration:** `.oxlintrc.json` registers `./tools/oxlint/anti-slop/index.ts` and enables
  every generic rule plus `oxc/no-accumulating-spread` at error. `npm run lint` runs ESLint,
  then Oxlint.

## Deviations from the skill's defaults

- **Effect rules:** the opt-in Effect plugin (`effect/`) is copied but not enabled, since this
  repo has no Effect dependency.
- **Ignores:** `.oxlintrc.json` also ignores `.wrangler/**` (Wrangler's local build output).
- **ESLint and Prettier** ignore `.agents`, `.claude` and this folder. Prettier also skips
  `skills-lock.json`.

The ESLint Stylistic code used by `require-readable-spacing` keeps its own provenance in
`vendor/eslint-stylistic/UPSTREAM.md` and `LICENSE`.
