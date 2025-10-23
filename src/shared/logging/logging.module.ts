import { LoggerModule } from 'nestjs-pino';
import { Module } from '@nestjs/common';
import type { Request, Response } from 'express';
import { appLoggerProvider } from './logging.providers';
import buildPinoTransport from './transport.util';
import { randomUUID } from 'crypto';
import { AppConfigUtil } from '../config/app-config.util';

function buildTransport() {
  return buildPinoTransport();
}

// removed unused redact helper

function truncateField(value: unknown, maxLength = 256): unknown {
  if (typeof value === 'string' && value.length > maxLength) {
    return value.slice(0, maxLength) + '...';
  }
  return value;
}

export function redactPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, any> = {};
  for (const key in payload) {
    if (
      ['password', 'token', 'secret', 'card', 'connectionString'].includes(key)
    ) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = truncateField(payload[key]);
    }
  }
  return result;
}

// Safe helpers that operate on unknown to avoid `any` usage in serializers.
function safeGetTraceContext(req: unknown): {
  traceId?: string;
  correlationId?: string;
} {
  if (!req || typeof req !== 'object') return {};
  const r = req as { context?: unknown };
  if (!r.context || typeof r.context !== 'object') return {};
  const c = r.context as Record<string, unknown>;
  return {
    traceId: typeof c.traceId === 'string' ? c.traceId : undefined,
    correlationId:
      typeof c.correlationId === 'string' ? c.correlationId : undefined,
  };
}

function safeGetReqFields(req: unknown) {
  if (!req || typeof req !== 'object') return {} as Record<string, unknown>;
  const r = req as Record<string, unknown>;
  const id = typeof r['id'] === 'string' ? r['id'] : undefined;
  const method = typeof r['method'] === 'string' ? r['method'] : undefined;
  const url = typeof r['url'] === 'string' ? r['url'] : undefined;
  let route: string | undefined = undefined;
  if (r['route'] && typeof r['route'] === 'object') {
    const routeObj = r['route'] as Record<string, unknown>;
    if (typeof routeObj['path'] === 'string') route = routeObj['path'];
  }
  let userAgent = '';
  if (r['headers'] && typeof r['headers'] === 'object') {
    const headers = r['headers'] as Record<string, unknown>;
    const ua = headers['user-agent'];
    if (Array.isArray(ua) && ua.length > 0 && typeof ua[0] === 'string')
      userAgent = ua[0];
    else if (typeof ua === 'string') userAgent = ua;
  }
  let ip: string | undefined = undefined;
  if (typeof r['ip'] === 'string') ip = r['ip'];
  else if (r['connection'] && typeof r['connection'] === 'object') {
    const conn = r['connection'] as Record<string, unknown>;
    if (typeof conn['remoteAddress'] === 'string') ip = conn['remoteAddress'];
    else if (typeof conn['remoteAddr'] === 'string') ip = conn['remoteAddr'];
  }
  return { id, method, url, route, userAgent, ip } as Record<string, unknown>;
}

function safeGetResContentLength(res: unknown): string | undefined {
  if (!res || typeof res !== 'object') return undefined;
  const r = res as Record<string, unknown>;
  const getHeader = r['getHeader'] ?? r['get'];
  if (typeof getHeader === 'function') {
    const gh = getHeader as (...args: unknown[]) => unknown;
    const val: unknown = gh.call(res, 'content-length');
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    return undefined;
  }
  return undefined;
}

function safeGetStatusCode(res: unknown): number | undefined {
  if (!res || typeof res !== 'object') return undefined;
  const r = res as Record<string, unknown>;
  const sc = r['statusCode'] ?? r['status'];
  return typeof sc === 'number' ? sc : undefined;
}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: AppConfigUtil.getLogLevel(),
        transport: buildTransport(),
        genReqId: (req) =>
          (req.headers['x-request-id'] as string) || randomUUID(),
        customAttributeKeys: { reqId: 'traceId' },
        customProps: (req: unknown) => {
          const config = AppConfigUtil.getLoggingConfig();
          const ctx = safeGetTraceContext(req);
          return {
            app: config.appName,
            environment: config.environment,
            version: config.appVersion,
            trace: { id: ctx.traceId },
            correlationId: ctx.correlationId,
          };
        },
        serializers: {
          req(req: unknown) {
            const f = safeGetReqFields(req);
            return {
              id: f['id'],
              method: f['method'],
              url: f['url'],
              route: f['route'],
              user_agent: { original: f['userAgent'] ?? '' },
              client: { ip: f['ip'] },
            };
          },
          res(res: unknown) {
            const statusCode = safeGetStatusCode(res);
            const content_length = safeGetResContentLength(res);
            return {
              status_code: statusCode,
              content_length,
            };
          },
          err(err: Error) {
            return {
              type: err?.name,
              message: err?.message,
              stack: err?.stack,
            };
          },
        },
      },
    }),
  ],
  providers: [appLoggerProvider],
  exports: [appLoggerProvider],
})
export class LoggingModule {}
