/**
 * Generic Template Renderer Service
 *
 * Provides reusable template rendering logic for any messaging context.
 * Handles JSON block parsing, variable interpolation, and validation.
 */

import { Injectable } from '@nestjs/common';
import type {
  RenderableTemplate,
  TemplateRenderOptions,
  TemplateRenderResult,
  TemplateValidationResult,
} from './template.types';

@Injectable()
export class TemplateRendererService {
  /**
   * Validate template blocks structure and count
   */
  validateTemplate(
    blocks: unknown[],
    maxBlocks = 50, // Default reasonable limit
  ): TemplateValidationResult {
    if (!Array.isArray(blocks)) {
      return { ok: false, error: 'invalid_blocks' };
    }
    if (blocks.length > maxBlocks) {
      return { ok: false, error: 'too_many_blocks' };
    }
    return { ok: true };
  }

  /**
   * Render template with variable substitution
   */
  renderTemplate(opts: TemplateRenderOptions): TemplateRenderResult {
    const { template, variables, maxBlocks } = opts;

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
        ok: false,
        error: `invalid_content_blocks:${e.message}`,
      };
    }

    // Validate parsed blocks
    const valid = this.validateTemplate(parsedBlocks, maxBlocks);
    if (!valid.ok) return valid;

    // Check if required variables exist
    for (const variableName of template.variables ?? []) {
      const val = this.getPath(variables, variableName);
      if (val === undefined || val === null) {
        return { ok: false, error: `missing_var:${variableName}` };
      }
    }

    // Simple interpolation pass for text sections: {{var.path}}
    const rendered = JSON.parse(
      JSON.stringify(parsedBlocks),
      (_k, value: unknown) => {
        if (typeof value === 'string' && value.includes('{{')) {
          return value.replace(/{{\s*([\w.$[\]]+)\s*}}/g, (_m, p1: string) => {
            const v = this.getPath(variables, p1);
            if (v === undefined || v === null) return '';
            if (typeof v === 'object') return '[object]';
            if (typeof v === 'number' || typeof v === 'boolean') {
              return String(v);
            }
            return v as string;
          });
        }
        return value;
      },
    ) as unknown;

    return { ok: true, value: rendered };
  }

  /**
   * Get nested object property by dot notation path
   */
  private getPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, key) => {
      if (acc && typeof acc === 'object' && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
