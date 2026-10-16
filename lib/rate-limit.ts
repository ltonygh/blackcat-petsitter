/**
 * Simple in-memory rate limiter for presign requests.
 *
 * NOTE: this is process-local state (a Map). It is intentionally NOT backed by
 * an external store for this task, so it resets on deploy and is not shared
 * across multiple instances. That is acceptable for the current single-instance
 * deployment; a distributed store can replace it later.
 */

type Bucket = number[]; // timestamps (ms) of recent requests

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const LIMIT_PER_HOUR = 10;
const LIMIT_PER_DAY = 50;

const buckets = new Map<string, Bucket>();

/**
 * Returns true if the user is allowed to make another presign request.
 * Records the request timestamp when allowed.
 */
export function checkPresignRateLimit(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - DAY_MS;

  // Prune anything older than a day on every call to keep memory bounded.
  const recent = (buckets.get(userId) ?? []).filter((t) => t > cutoff);

  const lastHour = recent.filter((t) => t > now - HOUR_MS).length;
  const lastDay = recent.length;

  if (lastHour >= LIMIT_PER_HOUR || lastDay >= LIMIT_PER_DAY) {
    buckets.set(userId, recent);
    return false;
  }

  recent.push(now);
  buckets.set(userId, recent);
  return true;
}

/** Test/utility hook: clear the limiter state. */
export function resetPresignRateLimit(userId?: string): void {
  if (userId) buckets.delete(userId);
  else buckets.clear();
}
