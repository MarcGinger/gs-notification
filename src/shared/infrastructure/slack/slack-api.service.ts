import { Injectable } from '@nestjs/common';
import { WebClient, WebClientOptions, LogLevel } from '@slack/web-api';

export type SlackSendOptions = {
  botToken: string; // resolved from secret ref upstream
  channel: string; // channel or user ID
  blocks: any[]; // Block Kit blocks
  text?: string; // fallback/plain text
  thread_ts?: string | null; // optional for threaded replies
};

export type SlackMessageResponse = { ts: string; channel: string };

@Injectable()
export class SlackApiService {
  private readonly defaultOpts: WebClientOptions = {
    logLevel: LogLevel.ERROR,
  };

  private client(token: string) {
    return new WebClient(token, this.defaultOpts);
  }

  async sendMessage(
    opts: SlackSendOptions,
  ): Promise<
    | { ok: true; value: SlackMessageResponse }
    | { ok: false; error: string; retryable: boolean; retryAfterSec?: number }
  > {
    try {
      const web = this.client(opts.botToken);
      const res = await web.chat.postMessage({
        channel: opts.channel,
        text: opts.text ?? 'Notification',
        blocks: opts.blocks as any, // Block Kit types are complex and validated by Slack API
        thread_ts: opts.thread_ts ?? undefined,
      });

      if (!res.ok) {
        // Slack sometimes returns ok=false with an error string
        return this.classifySlackError(res.error || 'unknown_error');
      }
      return {
        ok: true,
        value: { ts: String(res.ts), channel: String(res.channel) },
      };
    } catch (err: unknown) {
      // Extract error information safely
      const errorCode = this.extractErrorCode(err);
      const retryAfter = this.extractRetryAfter(err);
      const classified = this.classifySlackError(errorCode, retryAfter);
      return classified;
    }
  }

  async validateToken(botToken: string) {
    try {
      const web = this.client(botToken);
      const res = await web.auth.test();
      return { ok: true as const, value: !!res.ok };
    } catch {
      return { ok: false as const, error: 'invalid_auth' };
    }
  }

  private classifySlackError(code: string, retryAfter?: number) {
    const retryable = [
      'rate_limited',
      'internal_error',
      'service_unavailable',
      'timeout',
    ].includes(code);
    return {
      ok: false as const,
      error: code,
      retryable,
      retryAfterSec: retryAfter,
    };
  }

  private extractErrorCode(err: unknown): string {
    if (typeof err === 'object' && err !== null) {
      const error = err as Record<string, unknown>;
      const dataError = (error.data as Record<string, unknown>)?.error;
      const code = error.code;

      if (typeof dataError === 'string') return dataError;
      if (typeof code === 'string') return code;
    }
    return 'unknown_error';
  }

  private extractRetryAfter(err: unknown): number | undefined {
    if (typeof err === 'object' && err !== null) {
      const error = err as Record<string, unknown>;
      const headers = error.headers as Record<string, unknown>;
      const retryAfter = headers?.['retry-after'];
      return retryAfter ? Number(retryAfter) : undefined;
    }
    return undefined;
  }
}
