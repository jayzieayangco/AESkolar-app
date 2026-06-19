const STORAGE_PREFIX = "aeskolar_avatar_";

let cache = {};
const listeners = new Set();

export function getCachedAvatarUrl(userId) {
  if (!userId) return null;
  if (cache[userId]) return cache[userId];
  return localStorage.getItem(`${STORAGE_PREFIX}${userId}`) || null;
}

export function setCachedAvatarUrl(userId, url) {
  if (!userId) return;
  cache[userId] = url;
  if (url) localStorage.setItem(`${STORAGE_PREFIX}${userId}`, url);
  else localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
  listeners.forEach((fn) => fn(userId, url));
}

export function subscribeAvatarUpdates(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
