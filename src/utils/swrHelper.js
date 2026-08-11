/* ============================================================
   Utility: swrHelper.js (Client Portal)
   Description: User-scoped SWR (Stale-While-Revalidate) cache
                for instant page navigation & real-time updates.
   ============================================================ */

const SWR_PREFIX = 'swr_';
const DEFAULT_TTL_MINUTES = 10;

/**
 * Extract userId from stored client auth data for user-scoped cache keys.
 */
export function getSWRUserId() {
  try {
    const raw = localStorage.getItem('kfpl_client_auth');
    if (!raw) return 'anon';
    const parsed = JSON.parse(raw);
    const user = parsed?.client || parsed?.user || parsed?.data || parsed;
    return user?._id || user?.id || 'anon';
  } catch { return 'anon'; }
}

function buildKey(userId, cacheKey) {
  return `${SWR_PREFIX}${userId}_${cacheKey}`;
}

export function getSWRCache(cacheKey) {
  try {
    const userId = getSWRUserId();
    const key = buildKey(userId, cacheKey);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || !entry.data) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch { return null; }
}

export function setSWRCache(cacheKey, data, ttlMinutes = DEFAULT_TTL_MINUTES) {
  try {
    const userId = getSWRUserId();
    const key = buildKey(userId, cacheKey);
    const entry = {
      data,
      savedAt: Date.now(),
      expiresAt: Date.now() + (ttlMinutes * 60 * 1000),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SWR_PREFIX)) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
  }
}

export function mutateSWRCache(cacheKey, mutatorFn) {
  try {
    const userId = getSWRUserId();
    const key = buildKey(userId, cacheKey);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const entry = JSON.parse(raw);
    if (!entry || !entry.data) return;
    entry.data = mutatorFn(entry.data);
    entry.savedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}

export function invalidateSWRCache(cacheKey) {
  try {
    const userId = getSWRUserId();
    const key = buildKey(userId, cacheKey);
    localStorage.removeItem(key);
  } catch {}
}

export function clearAllSWRCache() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SWR_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
}

export function createSWRFetcher(cacheKey, fetchFn, setData, setLoading, ttlMinutes = DEFAULT_TTL_MINUTES) {
  const cached = getSWRCache(cacheKey);
  if (cached) {
    setData(cached);
    if (setLoading) setLoading(false);
  }

  const revalidate = async (silent = !!cached) => {
    if (!silent && setLoading) setLoading(true);
    try {
      const freshData = await fetchFn();
      setData(freshData);
      setSWRCache(cacheKey, freshData, ttlMinutes);
    } catch (err) {
      if (!cached) throw err;
      console.warn(`[SWR] Background revalidation failed for "${cacheKey}":`, err.message);
    } finally {
      if (setLoading) setLoading(false);
    }
  };

  return { cached: !!cached, revalidate };
}
