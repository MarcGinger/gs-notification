# Contributing to docs (short guide)

Purpose

- Keep documentation co-located, consistent, and easy to review.

When to create a `.doc.ts` vs `.md`

- Create a `.doc.ts` when you need a domain-specific Swagger/OpenAPI definition programmatically (recommended for API docs).
- Use `.md` for human-focused guides, HOWTOs, and contributor instructions.

Minimal `.doc.ts` skeleton

```ts
// ...existing code...
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { YourDomainModule } from '../your-domain.module';

export class YourDomainDocumentation {
  static setup(app: INestApplication): void {
    const config = new DocumentBuilder()
      .setTitle('Your Domain API')
      .setDescription('Short description...')
      .addTag('your-domain')
      .build();

    const document = SwaggerModule.createDocument(app, config, {
      include: [YourDomainModule],
    });

    SwaggerModule.setup('api/docs/your-domain', app, document);
  }
}
// ...existing code...
```

File metadata (recommended header)

- Add a short comment header to the top of each doc with: owner, last-updated, status.

Example header

```text
// owner: team-name
// last-updated: 2025-08-18
// status: draft|reviewed|approved
```

Pull request checklist for docs

- [ ] Title describes the change (e.g., "docs: add payments domain swagger")
- [ ] Added/updated the `.doc.ts` next to the domain code
- [ ] Exported from `src/docs/index.ts` only if central export is desired
- [ ] Included a short description and tags in the DocumentBuilder
- [ ] Confirmed doc registration is gated by non-production environment check
- [ ] Added or updated README/TOC if this is a visible top-level doc
- [ ] Marked owner and status in the doc header

Small style rules

- Keep prose short and task-focused. Use active voice.
- Prefer code examples that are copy-paste ready.
- Keep endpoints consistent: use `/api/docs/<domain>`.

CI suggestions (optional)

- Add a lightweight `markdown-link-check` job for `.md` files.
- Lint `.doc.ts` files with the project's ESLint setup.

If you want, I can add the `docs:check` and `docs:lint` scripts to `package.json` and a tiny GitHub Actions workflow to run them on PRs.

Thank you for keeping the docs clear and close to the code.
