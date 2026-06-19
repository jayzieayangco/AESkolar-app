import { useCallback, useRef, useState } from "react";
import { isAuthRateLimitError } from "../utils/validation.js";

const RATE_LIMIT_COOLDOWN_MS = 60_000;

/**
 * Prevents duplicate auth API calls (spam-click / rate limits).
 */
export function useAuthSubmitGuard() {
  const inFlightRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const isCoolingDown = Date.now() < cooldownUntil;
  const isBlocked = loading || inFlightRef.current || isCoolingDown;

  const applyRateLimitCooldown = useCallback((error) => {
    if (isAuthRateLimitError(error)) {
      setCooldownUntil(Date.now() + RATE_LIMIT_COOLDOWN_MS);
    }
  }, []);

  const runAuthAction = useCallback(
    async (action) => {
      if (inFlightRef.current || Date.now() < cooldownUntil) {
        return { data: null, error: new Error("Please wait before trying again.") };
      }

      inFlightRef.current = true;
      setLoading(true);
      try {
        return await action();
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [cooldownUntil]
  );

  return {
    loading,
    isBlocked,
    isCoolingDown,
    runAuthAction,
    applyRateLimitCooldown,
  };
}
