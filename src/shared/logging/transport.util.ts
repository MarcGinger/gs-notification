import { AppConfigUtil } from '../config/app-config.util';

/**
 * Centralized transport builder for pino transports.
 * Returns a pino transport descriptor or undefined for default stdout.
 */
export function buildPinoTransport(
  config?: ReturnType<typeof AppConfigUtil.getLoggingConfig>,
) {
  const cfg = config || AppConfigUtil.getLoggingConfig();

  if (cfg.sink === 'console' && cfg.pretty) {
    return { target: 'pino-pretty', options: { translateTime: 'UTC:isoTime' } };
  }

  if (cfg.sink === 'loki') {
    return {
      target: 'pino-loki',
      options: {
        host: cfg.loki.url,
        basicAuth: cfg.loki.basicAuth,
        batching: true,
        interval: 2000,
        labels: {
          app: cfg.appName,
          env: cfg.environment,
        },
      },
    };
  }

  if (cfg.sink === 'elasticsearch') {
    return {
      target: 'pino-elasticsearch',
      options: {
        node: cfg.elasticsearch.node,
        index: cfg.elasticsearch.index,
        esVersion: 8,
      },
    };
  }

  return undefined;
}

export default buildPinoTransport;
