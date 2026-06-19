import { useEffect, useState } from "react";

/**
 * Small debounce hook (dependency-free).
 * @template T
 * @param {T} value
 * @param {number} delayMs
 * @returns {T}
 */
export function useDebounce(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

