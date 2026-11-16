# Vite+ Monorepo Starter

A starter for creating a Vite+ monorepo.

## Development

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp run -r test
```

- Build the monorepo:

```bash
vp run -r build
```

- Detect duplicate code with [similarity-ts](https://github.com/mizchi/similarity) (requires `cargo install similarity-ts`):

```bash
vp run similarity     # report (threshold 0.85, includes experimental overlap detection)
vp run similarity:ci  # fail on near-exact duplicates (threshold 0.95)
```

- Run the development server:

```bash
vp run dev
```
