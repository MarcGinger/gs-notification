# 📚 Modular Swagger Documentation Structure

## 🎯 Overview

This project implements a **DDD-aligned, modular approach** to organizing Swagger documentation that co-locates documentation with domain modules, making the codebase more maintainable and ownership clearer.

## src/docs — concise overview

This folder contains the project's API documentation sources and a small set of utilities used to compose Swagger docs.

Purpose

- Explain where documentation lives and how to add small, domain-scoped Swagger docs.
- Provide an easy on-ramp for contributors.

Source types

- `.doc.ts` — TypeScript modules that programmatically build and register Swagger docs (preferred primary source).
- `.md` — supporting guides and human-readable content (this README and CONTRIBUTING_DOCS.md).

Quick links

- `index.ts` — re-exports or helper types used by the doc modules.
- `swagger-utils.ts` / `swagger-config.util.ts` — small helpers for configuring Swagger.

Add a new domain doc (recommended minimal steps)

1. Create a doc module next to the domain module: `your-domain/docs/your-domain.doc.ts`.
2. Export the doc class from `src/docs/index.ts` (optional central export).
3. Register the documentation during app bootstrap (only in non-production):

```powershell
# example (powershell)
# in your main.ts or bootstrap file, call the doc setup for local/dev
YourDomainDocumentation.setup(app, port);
```

Recommended conventions (short)

- Keep docs co-located with code that they document.
- Each `.doc.ts` should register a single Swagger endpoint and use a clear tag name.
- Do not enable detailed docs in production; keep production-safe summaries only.

Want CI checks or scripts?
If you'd like I can add small npm scripts for link-checking and a docs build step. Example suggestions to add to `package.json`:

```json
"scripts": {
  "docs:check": "markdown-link-check 'src/docs/**/*.md'",
  "docs:lint": "eslint 'src/docs/**/*.ts' --ext .ts",
  "docs:build": "(optional) run your static-site or doc generator here"
}
```

If you want, I will add a focused `CONTRIBUTING_DOCS.md` with a short template and PR checklist (small, actionable).

---

Summary: this README is intentionally short—see `CONTRIBUTING_DOCS.md` for conventions and examples.

- Adding new modules automatically gets its own docs folder
