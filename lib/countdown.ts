// Mayhem Week starts Fri Dec 25 2026 00:00 GMT; the Countdown runs until then.
export const EVENT_START = Date.UTC(2026, 11, 25);

// [days, hours, minutes, seconds] left at `now` (ms), floored at zero.
export function timeLeft(now: number, target = EVENT_START) {
  const s = Math.max(0, Math.floor((target - now) / 1000));
  return [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60] as const;
}
