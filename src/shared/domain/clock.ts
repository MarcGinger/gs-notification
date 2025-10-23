export interface Clock {
  now(): Date;
  nowIso(): string;
}

export const SystemClock: Clock = {
  now: () => new Date(),
  nowIso: () => new Date().toISOString(),
};
