import { useEffect, useRef, useCallback } from "react";

/**
 * Prompts when navigating away with unsaved changes (browser tab close + manual confirm).
 */
export function useUnsavedChanges(isDirty) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const confirmIfDirty = useCallback(() => {
    if (!isDirtyRef.current) return true;
    return window.confirm("Are you sure? Changes may not be saved.");
  }, []);

  return { confirmIfDirty };
}
