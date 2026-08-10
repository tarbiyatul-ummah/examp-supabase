type CacheEntry = {
  value: unknown;
  expiresAt: number;
  tags: Set<string>;
};

type CacheOptions = {
  ttlMs: number;
  tags?: readonly string[];
};

type InFlightEntry = {
  promise: Promise<unknown>;
  tags: Set<string>;
};

const MAX_CACHE_ENTRIES = 100;
const entries = new Map<string, CacheEntry>();
const inFlight = new Map<string, InFlightEntry>();
let cacheEpoch = 0;

export const REQUEST_CACHE_TAGS = {
  examLists: "exam-lists",
  studentExams: "student-exams",
  attemptHistory: "attempt-history",
  studentLists: "student-lists",
  leaderboards: "leaderboards",
} as const;

function copy<T>(value: T): T {
  return structuredClone(value);
}

function prune(now: number) {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
  while (entries.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = entries.keys().next().value as string | undefined;
    if (!oldestKey) break;
    entries.delete(oldestKey);
  }
}

export async function cachedRequest<T>(
  key: string,
  loader: () => Promise<T>,
  { ttlMs, tags = [] }: CacheOptions,
): Promise<T> {
  const now = Date.now();
  const cached = entries.get(key);
  if (cached && cached.expiresAt > now) return copy(cached.value as T);
  if (cached) entries.delete(key);

  const pending = inFlight.get(key)?.promise as Promise<T> | undefined;
  if (pending) return copy(await pending);

  const requestEpoch = cacheEpoch;
  const request = loader()
    .then((value) => {
      if (ttlMs > 0 && requestEpoch === cacheEpoch) {
        prune(Date.now());
        entries.set(key, {
          value: copy(value),
          expiresAt: Date.now() + ttlMs,
          tags: new Set(tags),
        });
      }
      return value;
    })
    .finally(() => {
      if (inFlight.get(key)?.promise === request) inFlight.delete(key);
    });

  inFlight.set(key, { promise: request, tags: new Set(tags) });
  return copy(await request);
}

export function invalidateCachedRequests(...tags: string[]) {
  if (!tags.length) return;
  cacheEpoch += 1;
  const targets = new Set(tags);
  for (const [key, entry] of entries) {
    if ([...entry.tags].some((tag) => targets.has(tag))) entries.delete(key);
  }
  for (const [key, request] of inFlight) {
    if ([...request.tags].some((tag) => targets.has(tag))) inFlight.delete(key);
  }
}

export function clearRequestCache() {
  cacheEpoch += 1;
  entries.clear();
  inFlight.clear();
}
