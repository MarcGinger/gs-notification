import { Injectable } from '@nestjs/common';

// Import the actual DTO type from your existing template response
import { DetailTemplateResponse } from 'src/contexts/notification/slack-config/template/application/dtos';

@Injectable()
export class TemplateRendererService {
  validateTemplate(
    blocks: unknown[],
    maxBlocks = Number(process.env.SLACK_MESSAGE_MAX_BLOCKS ?? 50),
  ) {
    if (!Array.isArray(blocks))
      return { ok: false as const, error: 'invalid_blocks' };
    if (blocks.length > maxBlocks)
      return { ok: false as const, error: 'too_many_blocks' };
    return { ok: true as const };
  }

  renderTemplate(opts: {
    template: DetailTemplateResponse;
    variables: Record<string, unknown>;
  }) {
    const { template, variables } = opts;

    // Parse contentBlocks from string array to actual objects
    let parsedBlocks: unknown[];
    try {
      parsedBlocks = template.contentBlocks.map((block, index) => {
        if (typeof block === 'string') {
          try {
            return JSON.parse(block) as unknown;
          } catch (parseError) {
            throw new Error(`Block ${index}: ${(parseError as Error).message}`);
          }
        }
        return block as unknown;
      });
    } catch (error) {
      const e = error as Error;
      return {
        ok: false as const,
        error: `invalid_content_blocks:${e.message}`,
      };
    }

    const valid = this.validateTemplate(parsedBlocks);
    if (!valid.ok) return valid;

    // Check if required variables exist (template.variables is string[] of variable names)
    for (const variableName of template.variables ?? []) {
      const val = this.getPath(variables, variableName);
      if (val === undefined || val === null) {
        return { ok: false as const, error: `missing_var:${variableName}` };
      }
    }

    // Simple interpolation pass for plain_text sections: {{var.path}}
    const rendered = JSON.parse(
      JSON.stringify(parsedBlocks),
      (_k, value: unknown) => {
        if (typeof value === 'string' && value.includes('{{')) {
          return value.replace(/{{\s*([\w.$[\]]+)\s*}}/g, (_m, p1: string) => {
            const v = this.getPath(variables, p1);
            if (v === undefined || v === null) return '';
            if (typeof v === 'object') return '[object]';
            if (typeof v === 'number' || typeof v === 'boolean')
              return String(v);
            return v as string;
          });
        }
        return value;
      },
    ) as unknown;

    return { ok: true as const, value: rendered };
  }

  private getPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, key) => {
      if (acc && typeof acc === 'object' && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
