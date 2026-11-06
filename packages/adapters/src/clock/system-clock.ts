import type { ClockPort } from '@escenai/core';

export class SystemClock implements ClockPort {
  nowIso(): string {
    return new Date().toISOString();
  }
}
