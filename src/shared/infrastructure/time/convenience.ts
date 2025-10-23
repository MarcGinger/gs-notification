// Convenience exports for runtime use. Keep domain modules importing only the Clock interface
// or receiving Clock via DI. Exporting systemClock here makes accidental direct imports from
// `clock.ts` less likely and centralizes the runtime instance.
import { SystemClock } from './clock';

export const systemClock = new SystemClock();
