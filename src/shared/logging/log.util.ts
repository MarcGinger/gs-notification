import { Logger } from './enhanced-logger.factory';

export function componentLogger(base: Logger, component: string): Logger {
  // Create once per class to avoid repeating `component` in each call
  return base.child({ component });
}
