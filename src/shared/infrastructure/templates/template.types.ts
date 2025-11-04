/**
 * Generic Template Rendering Types
 *
 * Shared interfaces for template rendering across different messaging contexts
 * (Slack, Email, SMS, Webhooks, etc.)
 */

/**
 * Generic template interface for rendering
 */
export interface RenderableTemplate {
  /** Unique template identifier */
  code: string;

  /** Human-readable template name */
  name: string;

  /** Template description */
  description?: string;

  /** Template content blocks (JSON strings or objects) */
  contentBlocks: (string | object)[];

  /** Required variable names for template rendering */
  variables?: string[];

  /** Sample payload for testing/validation */
  samplePayload?: Record<string, unknown>;

  /** Whether template is enabled for use */
  enabled: boolean;
}

/**
 * Template rendering options
 */
export interface TemplateRenderOptions {
  /** Template to render */
  template: RenderableTemplate;

  /** Variable values for template interpolation */
  variables: Record<string, unknown>;

  /** Maximum number of blocks allowed (platform-specific) */
  maxBlocks?: number;
}

/**
 * Template rendering result
 */
export type TemplateRenderResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

/**
 * Template validation result
 */
export type TemplateValidationResult =
  | { ok: true }
  | { ok: false; error: string };
