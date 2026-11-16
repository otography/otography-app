---
name: check-similarity-ts
description: Detect duplicate TypeScript/JavaScript code in this monorepo using similarity-ts (AST-based similarity). Use when looking for code duplication or refactoring opportunities in apps/ or packages/.
argument-hint: "[path] [--threshold 0.85] [--print]"
allowed-tools: Bash(similarity-ts *) Bash(vp run similarity*) Read Grep Glob
paths: "**/*.ts,**/*.tsx,**/*.js,**/*.jsx"
---

# TypeScript/JavaScript Code Similarity Detection

Based on the upstream skill from https://github.com/mizchi/similarity (adapted to similarity-ts v0.5.0 flags and this repo's layout).

## Step 1: Run the analysis

If `similarity-ts` is missing, install it: `cargo install similarity-ts`.

- With arguments: `similarity-ts $ARGUMENTS`
- Without arguments: `vp run similarity` (scans `apps` and `packages`, excludes generated `*.gen.ts`, threshold 0.85, min-tokens 25, types and experimental overlap detection enabled)

Useful follow-ups:

- `similarity-ts <fileA> <fileB> --threshold 0.75 --print` — inspect one pair with code
- `similarity-ts apps packages --experimental-overlap --threshold 0.75 --print` — partial copy-paste inside larger functions
- `similarity-ts apps packages --classes` — include class comparison

## Step 2: Prioritize

- **100%**: exact duplicate — extract a shared function (e.g. into `packages/utils`)
- **95–100%**: parameterize the small difference
- **85–95%**: same pattern (API handlers, data mapping) — consider a shared helper
- Short utilities (< 5 lines) and overload-like variants are usually acceptable

Intentional duplicates can be silenced with a `// similarity-ignore` comment directly above the function, type, or class (`--show-ignored` lists them).

## Step 3: Propose refactoring

For each high-priority pair, show before/after code with a concrete implementation, then re-run to confirm.
