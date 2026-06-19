import { useEffect, useRef, useCallback } from "react";
import {
  getSession,
  saveDocument,
  getAssignmentTaskById,
} from "../services/api.js";

const LOCAL_DRAFT_PREFIX = "aeskolar_local_draft:";

function getLocalDraftKey({ role, assignmentTaskId }) {
  const taskPart =
    assignmentTaskId == null ? "general" : String(assignmentTaskId);
  return `${LOCAL_DRAFT_PREFIX}${role}:${taskPart}`;
}

/**
 * Auto-saves document draft after debounceMs of inactivity.
 * @param {{ title: string, content: string, documentId?: string|null, role: string, assignmentTaskId?: number|null }} doc
 * @param {{ debounceMs?: number, enabled?: boolean, onStatus?: (status: 'saving'|'saved'|'error', msg?: string) => void }} options
 */
export function useDebouncedDocumentSave(doc, options = {}) {
  const { debounceMs = 2000, enabled = true, onStatus } = options;
  const { title, content, role, assignmentTaskId } = doc;

  const documentIdRef = useRef(doc.documentId);
  const lastSavedRef = useRef({ title: title ?? "", content: content ?? "" });
  const timerRef = useRef(null);
  const savingRef = useRef(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    documentIdRef.current = doc.documentId;
  }, [doc.documentId]);

  const persist = useCallback(async () => {
    if (savingRef.current) return documentIdRef.current;

    const { session } = await getSession();
    const t = title?.trim() ?? "";
    const c = content ?? "";
    if (!t && !c) return documentIdRef.current;

    // If unauthenticated, persist locally (so debounce still works for all users).
    if (!session) {
      try {
        const key = getLocalDraftKey({ role, assignmentTaskId });
        localStorage.setItem(
          key,
          JSON.stringify({
            title: t,
            content: c,
            role,
            assignmentTaskId: assignmentTaskId ?? null,
            updatedAt: new Date().toISOString(),
          }),
        );
        console.debug("[Draft] saved locally", { key });
        lastSavedRef.current = { title: t, content: c };
        onStatusRef.current?.("saved");
      } catch (e) {
        console.warn("[Draft] local save failed", e);
        onStatusRef.current?.(
          "error",
          "Could not save locally. Please try again.",
        );
      }
      return documentIdRef.current;
    }

    savingRef.current = true;
    onStatusRef.current?.("saving");

    // Get class_id from assignment task if available
    let classId = null;
    if (assignmentTaskId) {
      const { data: task } = await getAssignmentTaskById(assignmentTaskId);
      classId = task?.class_id ?? null;
    }
    const { data, error } = await saveDocument({
      userId: session.user.id,
      role,
      title: t || "Untitled Draft",
      content: c,
      documentId: documentIdRef.current,
      assignmentTaskId,
      classId,
    });

    savingRef.current = false;

    if (error) {
      onStatusRef.current?.("error", error.message || "Failed to save draft.");
      return documentIdRef.current;
    }

    if (data?.id) documentIdRef.current = data.id;
    lastSavedRef.current = { title: t, content: c };
    onStatusRef.current?.("saved");

    // Clear any local unauth draft after successful sync.
    try {
      const key = getLocalDraftKey({ role, assignmentTaskId });
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.debug("[Draft] cleared local after sync", { key });
      }
    } catch {
      // ignore
    }
    return documentIdRef.current;
  }, [title, content, role, assignmentTaskId]);

  useEffect(() => {
    if (!enabled) return;

    const t = title?.trim() ?? "";
    const c = content ?? "";
    if (t === lastSavedRef.current.title && c === lastSavedRef.current.content)
      return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      persist();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [title, content, enabled, debounceMs, persist]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    return persist();
  }, [persist]);

  return { saveNow, getDocumentId: () => documentIdRef.current };
}
