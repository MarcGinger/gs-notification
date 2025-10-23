// Public time utilities and runtime convenience exports.
// Note: prefer passing a `Clock` via DI into domain modules. If you need the
// runtime instance for wiring or for small scripts, import it from the
// convenience module:
//   import { systemClock } from 'src/shared/time/convenience';
// This reduces accidental direct imports of the runtime from `clock.ts`.
export * from './clock';
export * from './iso';
export * from './convenience';
export * from './time.module';
export * from './nest-clock.provider';
