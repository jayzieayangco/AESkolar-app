import supabase from "../lib/supabaseClient.js";

const DOCUMENTS_BUCKET = "documents";
const AVATARS_BUCKET = "avatars";

/** @deprecated use DOCUMENTS_BUCKET */
const STORAGE_BUCKET = DOCUMENTS_BUCKET;

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

export function isRlsError(error) {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42501" ||
    code === "PGRST301" ||
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("violates row-level security")
  );
}

export function logSupabaseError(error, context) {
  if (!error) return null;

  const payload = {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    likelyRls: isRlsError(error),
  };

  if (payload.likelyRls) {
    console.error(
      `[Supabase RLS] ${context} — Row Level Security may be blocking this operation. Run supabase/rls_policies.sql or check policies.`,
      payload,
    );
  } else {
    console.error(`[Supabase] ${context}`, payload);
  }

  return error;
}

function toUserFriendlyDbError(error, context = "") {
  if (!error) return error;
  const message = String(error.message ?? "");
  const lower = message.toLowerCase();

  // Hide raw constraint strings from UI
  if (
    lower.includes("null value in column") &&
    lower.includes("assignment_task_id")
  ) {
    return { ...error, message: "Please select a task before saving." };
  }
  if (lower.includes("null value in column") && lower.includes("language_id")) {
    return { ...error, message: "Please select a language before saving." };
  }

  // Generic fallback for common Postgres constraint noise
  if (lower.includes("violates not-null constraint")) {
    return {
      ...error,
      message:
        "Missing required fields. Please review your selections and try again.",
    };
  }
  if (
    lower.includes("foreign key") &&
    (lower.includes("assignment_task") ||
      lower.includes("fk_rubric") ||
      lower.includes("rubrics"))
  ) {
    return {
      ...error,
      message:
        "That assignment does not exist. Create the assignment first, then link the rubric.",
    };
  }

  // Keep original by default
  return error;
}

/** Current authenticated user id (null if signed out). */
export async function getAuthUserId() {
  const { session } = await getSession();
  return session?.user?.id ?? null;
}

export async function assertAssignmentTaskExists(assignmentTaskId) {
  const id = Number(assignmentTaskId);
  if (!id || Number.isNaN(id)) {
    return {
      exists: false,
      error: new Error("Please enter a valid assignment task ID."),
    };
  }
  const { data, error } = await getAssignmentTaskById(id);
  if (error) return { exists: false, error };
  if (!data) {
    return {
      exists: false,
      error: new Error(
        "That assignment does not exist. Create the assignment on your dashboard first, then upload the rubric.",
      ),
    };
  }
  return { exists: true, task: data, error: null };
}

/**
 * @template T
 * @param {() => Promise<{ data: T | null; error: unknown }>} fn
 * @param {string} context
 */
async function safeQuery(fn, context) {
  try {
    const result = await fn();
    if (result.error) {
      logSupabaseError(result.error, context);
      return { ...result, error: toUserFriendlyDbError(result.error, context) };
    }
    return result;
  } catch (err) {
    console.error(`[Supabase] ${context} — unexpected error`, err);
    return { data: null, error: toUserFriendlyDbError(err, context) };
  }
}

function withErrorLogging(result, context) {
  if (result.error) logSupabaseError(result.error, context);
  return result;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function getSession() {
  try {
    const result = await supabase.auth.getSession();
    if (result.error) logSupabaseError(result.error, "auth.getSession");
    return { session: result.data?.session ?? null, error: result.error };
  } catch (error) {
    console.error("[Supabase] auth.getSession — unexpected error", error);
    return { session: null, error };
  }
}

export async function getCurrentUser() {
  try {
    const result = await supabase.auth.getUser();
    if (result.error) logSupabaseError(result.error, "auth.getCurrentUser");
    return { user: result.data?.user ?? null, error: result.error };
  } catch (error) {
    return { user: null, error };
  }
}

export async function signInWithGoogle(redirectPath = "/role_selection") {
  const cleanOrigin = window.location.origin.replace(/\/$/, "");
  return safeQuery(
    async () =>
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${cleanOrigin}${redirectPath}`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      }),
    "auth.signInWithGoogle",
  );
}

export async function signInWithEmail(email, password) {
  return safeQuery(
    async () => supabase.auth.signInWithPassword({ email, password }),
    "auth.signInWithEmail",
  );
}

export async function signUpWithEmail(email, password, metadata = {}) {
  return safeQuery(
    async () =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      }),
    "auth.signUpWithEmail",
  );
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) logSupabaseError(error, "auth.signOut");
    return { error };
  } catch (error) {
    console.error("[Supabase] auth.signOut — unexpected error", error);
    return { error };
  }
}

/**
 * Upserts public.users after OAuth / email sign-in.
 * @param {import('@supabase/supabase-js').Session | null} session
 * @param {{ role?: string }} [options]
 */
export async function syncUserToDatabase(session, options = {}) {
  if (!session?.user?.id) {
    return { data: null, error: new Error("No session user to sync.") };
  }

  const { data: existing } = await getUserProfile(session.user.id);
  const role = options.role ?? existing?.role ?? "student";
  const fullName =
    options.fullName ??
    existing?.full_name ??
    session.user.user_metadata?.full_name ??
    session.user.email?.split("@")[0] ??
    "User";

  return safeQuery(
    async () =>
      supabase
        .from("users")
        .upsert(
          {
            id: session.user.id,
            full_name: fullName,
            role,
          },
          { onConflict: "id" },
        )
        .select()
        .single(),
    "users.syncUserToDatabase",
  );
}

/** @alias syncUserToDatabase */
export async function syncUser(session, options) {
  return syncUserToDatabase(session, options);
}

export async function updateUserRole(userId, role) {
  return safeQuery(
    async () =>
      supabase
        .from("users")
        .update({ role })
        .eq("id", userId)
        .select()
        .single(),
    "users.updateUserRole",
  );
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export async function getUserProfile(userId) {
  return safeQuery(
    async () =>
      supabase.from("users").select("*").eq("id", userId).maybeSingle(),
    "users.getUserProfile",
  );
}

export const fetchUserProfile = getUserProfile;

export async function upsertUserProfile(profile) {
  return safeQuery(
    async () => supabase.from("users").upsert(profile).select().single(),
    "users.upsertUserProfile",
  );
}

export async function updateUserProfile(userId, updates) {
  return safeQuery(
    async () =>
      supabase.from("users").update(updates).eq("id", userId).select().single(),
    "users.updateUserProfile",
  );
}

export async function deleteUserProfile(userId) {
  return safeQuery(
    async () => supabase.from("users").delete().eq("id", userId),
    "users.deleteUserProfile",
  );
}

export async function listUsers() {
  return safeQuery(
    async () =>
      supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false }),
    "users.listUsers",
  );
}

// ---------------------------------------------------------------------------
// assignment_tasks
// ---------------------------------------------------------------------------

export async function fetchAssignmentTasks() {
  return listAssignmentTasks();
}

export async function listAssignmentTasks(filters = {}) {
  return safeQuery(async () => {
    let query = supabase.from("assignment_tasks").select("*");
    if (filters.createdBy) {
      query = query.eq("created_by", filters.createdBy);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    return query.order("created_at", { ascending: false });
  }, "assignment_tasks.list");
}

/** Student to-do: open tasks only (hide after submission). */
export async function fetchStudentTodoTasks(userId) {
  console.log("fetchStudentTodoTasks called with userId:", userId);

  // Get classes the student is enrolled in
  const { data: studentClasses, error: classErr } =
    await getStudentClasses(userId);
  console.log("studentClasses result:", studentClasses, "error:", classErr);
  if (classErr) return { data: null, error: classErr };

  const enrolledClassIds = (studentClasses ?? [])
    .map((sc) => sc.class_id)
    .filter(Boolean);
  console.log("enrolledClassIds:", enrolledClassIds);

  const { data: tasks, error: taskErr } = await listAssignmentTasks();
  console.log("all tasks:", tasks, "error:", taskErr);
  if (taskErr) return { data: null, error: taskErr };

  const { data: docs, error: docErr } = await fetchDocuments({ userId });
  if (docErr) return { data: null, error: docErr };

  const completedIds = new Set(
    (docs ?? [])
      .filter((d) =>
        ["submitted", "scored", "graded"].includes(
          String(d.status ?? "").toLowerCase(),
        ),
      )
      .map((d) => d.assignment_task_id)
      .filter(Boolean),
  );

  // Filter to only tasks for enrolled classes, or tasks without a class (global tasks)
  const open = (tasks ?? []).filter((t) => {
    const isNotCompleted = !completedIds.has(t.id);
    const isAccessible = !t.class_id || enrolledClassIds.includes(t.class_id);
    console.log(
      `Task ${t.id} (class_id: ${t.class_id}): not completed? ${isNotCompleted}, accessible? ${isAccessible}`,
    );
    return isNotCompleted && isAccessible;
  });
  console.log("final open tasks:", open);
  return { data: open, error: null };
}

/** Teacher-owned assignment tasks. */
export async function fetchTeacherAssignmentTasks(teacherId) {
  if (!teacherId) return { data: [], error: null };
  return listAssignmentTasks({ createdBy: teacherId });
}

/** Submissions for essays tied to a teacher's assignments. */
export async function fetchTeacherSubmissions(
  teacherId,
  { status, classId } = {},
) {
  return safeQuery(async () => {
    console.log(
      "fetchTeacherSubmissions called with teacherId:",
      teacherId,
      "classId:",
      classId,
    );
    const { data: tasks, error: taskErr } =
      await fetchTeacherAssignmentTasks(teacherId);
    console.log("teacher tasks:", tasks, "error:", taskErr);
    if (taskErr) return { data: null, error: taskErr };

    let filteredTasks = tasks ?? [];
    if (classId) {
      filteredTasks = filteredTasks.filter((t) => t.class_id === classId);
    }
    console.log("filtered tasks for submissions:", filteredTasks);

    const taskIds = filteredTasks.map((t) => t.id);
    console.log("task ids:", taskIds);
    if (!taskIds.length) return { data: [], error: null };

    let query = supabase
      .from("documents")
      .select("*")
      .eq("role", "student")
      .in("assignment_task_id", taskIds);

    if (status) {
      query = query.eq("status", status);
    } else {
      query = query.in("status", ["submitted", "scored", "graded"]);
    }

    const result = await query.order("created_at", { ascending: false });
    console.log("submissions query result:", result);
    return result;
  }, "documents.fetchTeacherSubmissions");
}

export async function getAssignmentTaskById(id) {
  return safeQuery(
    async () =>
      supabase.from("assignment_tasks").select("*").eq("id", id).maybeSingle(),
    "assignment_tasks.getById",
  );
}

export async function createAssignmentTask(task) {
  return safeQuery(
    async () =>
      supabase.from("assignment_tasks").insert(task).select().maybeSingle(),
    "assignment_tasks.create",
  );
}

export async function updateAssignmentTask(id, updates) {
  return safeQuery(
    async () =>
      supabase
        .from("assignment_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle(),
    "assignment_tasks.update",
  );
}

export async function deleteAssignmentTask(id) {
  return safeQuery(
    async () => supabase.from("assignment_tasks").delete().eq("id", id),
    "assignment_tasks.delete",
  );
}

// ---------------------------------------------------------------------------
// classes
// ---------------------------------------------------------------------------

export async function listClasses(filters = {}) {
  return safeQuery(async () => {
    let query = supabase
      .from("classes")
      .select("*, teacher:users!teacher_id(*)");
    if (filters.teacherId) query = query.eq("teacher_id", filters.teacherId);
    return query.order("class_name", { ascending: true });
  }, "classes.list");
}

export async function getClassById(id) {
  return safeQuery(
    async () => supabase.from("classes").select("*").eq("id", id).maybeSingle(),
    "classes.getById",
  );
}

export async function createClass(classRow) {
  // Generate random 6-character class code
  const generateClassCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  return safeQuery(
    async () =>
      supabase
        .from("classes")
        .insert({
          ...classRow,
          class_code: generateClassCode(),
        })
        .select()
        .maybeSingle(),
    "classes.create",
  );
}

export async function updateClass(id, updates) {
  return safeQuery(
    async () =>
      supabase
        .from("classes")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle(),
    "classes.update",
  );
}

export async function deleteClass(id) {
  return safeQuery(
    async () => supabase.from("classes").delete().eq("id", id),
    "classes.delete",
  );
}

export async function getClassByCode(classCode) {
  return safeQuery(
    async () =>
      supabase
        .from("classes")
        .select("*, teacher:users!teacher_id(*)")
        .eq("class_code", classCode)
        .maybeSingle(),
    "classes.getByCode",
  );
}

export async function joinClass(studentId, classId) {
  return safeQuery(
    async () =>
      supabase
        .from("student_classes")
        .insert({ student_id: studentId, class_id: classId })
        .select()
        .maybeSingle(),
    "studentClasses.join",
  );
}

export async function unenrollFromClass(studentId, classId) {
  return safeQuery(
    async () =>
      supabase
        .from("student_classes")
        .delete()
        .eq("student_id", studentId)
        .eq("class_id", classId),
    "studentClasses.unenroll",
  );
}

export async function getStudentClasses(studentId) {
  return safeQuery(async () => {
    console.log("getStudentClasses called with studentId:", studentId);
    const result = await supabase
      .from("student_classes")
      .select(
        "class_id, class:classes!class_id(*, teacher:users!teacher_id(*))",
      )
      .eq("student_id", studentId);
    console.log("getStudentClasses raw result:", result);
    return result;
  }, "studentClasses.getByStudent");
}

// ---------------------------------------------------------------------------
// documents
// ---------------------------------------------------------------------------

let _defaultAssignmentTaskId = null;
let _defaultLanguageId = null;

export async function verifyDatabaseSchema() {
  // Ensures seed rows exist for FK references.
  // If RLS blocks inserts, return a friendly error so the UI doesn't show raw DB messages.
  return safeQuery(async () => {
    const { data: langs, error: langErr } = await supabase
      .from("languages")
      .select("id,name")
      .order("name", { ascending: true })
      .limit(1);
    if (langErr) return { data: null, error: langErr };

    if (!langs?.length) {
      console.warn("[Supabase] languages empty — inserting default");
      const { data: inserted, error } = await supabase
        .from("languages")
        .insert({ name: "English" })
        .select("id,name")
        .single();
      if (error) return { data: null, error };
      console.debug("[Supabase] languages default inserted", inserted);
      _defaultLanguageId = inserted?.id ?? null;
    }

    const { data: tasks, error: taskErr } = await supabase
      .from("assignment_tasks")
      .select("id,title")
      .order("created_at", { ascending: true })
      .limit(1);
    if (taskErr) return { data: null, error: taskErr };

    if (!tasks?.length) {
      console.warn("[Supabase] assignment_tasks empty — inserting default");
      const { data: inserted, error } = await supabase
        .from("assignment_tasks")
        .insert({
          title: "General",
          instruction: "General writing task",
        })
        .select("id,title")
        .single();
      if (error) return { data: null, error };
      console.debug("[Supabase] assignment_tasks default inserted", inserted);
      _defaultAssignmentTaskId = inserted?.id ?? null;
    }

    return { data: { ok: true }, error: null };
  }, "db.verifyDatabaseSchema");
}

async function resolveDefaultAssignmentTaskId() {
  if (_defaultAssignmentTaskId != null) return _defaultAssignmentTaskId;
  const seed = await verifyDatabaseSchema();
  if (seed.error) throw seed.error;
  try {
    const { data, error } = await supabase
      .from("assignment_tasks")
      .select("id,title")
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw error;
    const id = data?.[0]?.id ?? null;
    if (!id) {
      throw new Error(
        "No assignment tasks exist. Create at least 1 row in assignment_tasks to avoid foreign key errors.",
      );
    }
    _defaultAssignmentTaskId = id;
    console.debug("[Supabase] defaults.assignment_task_id", {
      id,
      title: data?.[0]?.title ?? null,
    });
    return id;
  } catch (e) {
    console.warn("[Supabase] defaults.assignment_task_id resolve failed", e);
    throw e;
  }
}

async function resolveDefaultLanguageId() {
  if (_defaultLanguageId != null) return _defaultLanguageId;
  const seed = await verifyDatabaseSchema();
  if (seed.error) throw seed.error;
  try {
    const { data, error } = await supabase
      .from("languages")
      .select("id,name")
      .order("name", { ascending: true })
      .limit(1);
    if (error) throw error;
    const id = data?.[0]?.id ?? null;
    if (!id) {
      throw new Error(
        "No languages exist. Create at least 1 row in languages to avoid foreign key errors.",
      );
    }
    _defaultLanguageId = id;
    console.debug("[Supabase] defaults.language_id", {
      id,
      name: data?.[0]?.name ?? null,
    });
    return id;
  } catch (e) {
    console.warn("[Supabase] defaults.language_id resolve failed", e);
    throw e;
  }
}

/** Apply filters; treats excludeStatus 'trash' as "library" (includes null + draft rows). */
function applyDocumentQueryFilters(query, filters = {}) {
  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.role) {
    query = query.or(`role.eq.${filters.role},role.is.null`);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  } else if (filters.excludeStatus === "trash") {
    // SQL: NULL <> 'trash' is unknown — those rows were hidden before
    query = query.or("status.is.null,status.neq.trash");
  } else if (filters.excludeStatus) {
    query = query.neq("status", filters.excludeStatus);
  }
  if (filters.classId) query = query.eq("class_id", filters.classId);
  if (filters.assignmentTaskId) {
    query = query.eq("assignment_task_id", filters.assignmentTaskId);
  }
  return query;
}

/**
 * Main Documents page: drafts + other non-trash statuses for the current user.
 */
export async function fetchDocuments({ userId, role } = {}) {
  // Privacy: always scope to the authenticated user's documents (RLS-aligned).
  return safeQuery(async () => {
    const uid = userId ?? (await getAuthUserId());
    if (!uid) {
      return {
        data: [],
        error: new Error("You must be signed in to view documents."),
      };
    }
    console.debug("[Supabase] documents.fetchDocuments", { userId: uid, role });
    let query = supabase
      .from("documents")
      .select("*")
      .eq("user_id", uid)
      .or("status.is.null,status.neq.trash");
    if (role) {
      query = query.or(`role.eq.${role},role.is.null`);
    }
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) return { data: null, error };
    return { data: data ?? [], error: null };
  }, "documents.fetchDocuments");
}

/** @alias fetchStudentTodoTasks — assignment tasks for student dashboard */
export async function fetchTasks(userId) {
  return fetchStudentTodoTasks(userId);
}

/**
 * Trash page: only rows with status = 'trash'.
 */
export async function fetchTrash({ userId, role } = {}) {
  return safeQuery(async () => {
    const filters = { userId, role, status: "trash" };
    console.debug("[Supabase] documents.fetchTrash", filters);
    let query = supabase.from("documents").select("*").eq("status", "trash");
    query = applyDocumentQueryFilters(query, { userId, role });
    const result = await query.order("created_at", { ascending: false });
    if (!result.error) {
      console.debug("[Supabase] documents.fetchTrash result", {
        rowCount: result.data?.length ?? 0,
        filters,
      });
    }
    return result;
  }, "documents.fetchTrash");
}

export async function getDocuments(filters = {}) {
  return listDocuments(filters);
}

export async function listDocuments(filters = {}) {
  if (filters.teacherId && filters.scope === "submissions") {
    return fetchTeacherSubmissions(filters.teacherId, {
      status: filters.status,
    });
  }

  return safeQuery(async () => {
    console.debug("[Supabase] documents.list", filters);
    let query = supabase.from("documents").select("*");
    if (filters.userId) {
      query = query.eq("user_id", filters.userId);
    }
    query = applyDocumentQueryFilters(query, filters);
    const result = await query.order("created_at", { ascending: false });
    if (!result.error) {
      console.debug("[Supabase] documents.list result", {
        rowCount: result.data?.length ?? 0,
        filters,
      });
    }
    return result;
  }, "documents.list");
}

/**
 * Search documents by title OR content (case-insensitive).
 */
export async function searchDocuments({
  userId,
  role,
  query,
  excludeStatus = "trash",
}) {
  const term = query?.trim();
  if (!term) {
    return listDocuments({ userId, role, excludeStatus });
  }

  const pattern = `%${term.replace(/[%_,]/g, "")}%`;

  return safeQuery(async () => {
    const filters = { userId, role, query: term, excludeStatus };
    console.debug("[Supabase] documents.searchDocuments", filters);
    let q = supabase
      .from("documents")
      .select("*")
      .or(`title.ilike."${pattern}",content.ilike."${pattern}"`);

    q = applyDocumentQueryFilters(q, { userId, role, excludeStatus });

    const result = await q.order("created_at", { ascending: false });
    if (!result.error) {
      console.debug("[Supabase] documents.searchDocuments result", {
        rowCount: result.data?.length ?? 0,
        filters,
      });
    }
    return result;
  }, "documents.searchDocuments");
}

export async function getDocumentById(id) {
  return safeQuery(
    async () =>
      supabase.from("documents").select("*").eq("id", id).maybeSingle(),
    "documents.getById",
  );
}

export async function createDocument(document) {
  return safeQuery(async () => {
    const seed = await verifyDatabaseSchema();
    if (seed.error) return { data: null, error: seed.error };
    return supabase.from("documents").insert(document).select().maybeSingle();
  }, "documents.create");
}

export async function updateDocument(id, updates) {
  return safeQuery(async () => {
    const seed = await verifyDatabaseSchema();
    if (seed.error) return { data: null, error: seed.error };
    return supabase
      .from("documents")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();
  }, "documents.update");
}

export async function deleteDocument(id) {
  return safeQuery(
    async () => supabase.from("documents").delete().eq("id", id),
    "documents.delete",
  );
}

export async function moveDocumentToTrash(id) {
  return updateDocument(id, { status: "trash" });
}

export async function restoreDocument(id) {
  return updateDocument(id, { status: "draft" });
}

export async function submitDocument(id) {
  // First check if the task is overdue before allowing submission
  const { data: doc, error: docError } = await getDocumentById(id);
  if (docError) {
    return { data: null, error: docError };
  }

  if (doc?.assignment_task_id) {
    const { data: task, error: taskError } = await getAssignmentTaskById(
      doc.assignment_task_id,
    );
    if (task?.due_date) {
      const dueDate = new Date(task.due_date);
      const now = new Date();
      if (dueDate < now && doc.status !== "submitted") {
        return {
          data: null,
          error: {
            message:
              "This task is past its due date and can no longer be submitted.",
          },
        };
      }
    }
  }

  return updateDocument(id, { status: "submitted" });
}

/** @alias saveDocumentDraft */
export async function saveDocument(docData) {
  return saveDocumentDraft(docData);
}

export async function saveDocumentDraft({
  userId,
  role,
  title,
  content,
  documentId,
  assignmentTaskId,
  classId,
  languageId,
}) {
  let resolvedAssignmentTaskId;
  let resolvedLanguageId;
  try {
    resolvedAssignmentTaskId =
      assignmentTaskId == null
        ? await resolveDefaultAssignmentTaskId()
        : assignmentTaskId;
    resolvedLanguageId =
      languageId == null ? await resolveDefaultLanguageId() : languageId;
  } catch (e) {
    const err = toUserFriendlyDbError(
      e,
      "documents.saveDocumentDraft.defaults",
    );
    return { data: null, error: err };
  }

  const payload = {
    user_id: userId,
    role,
    title: title || "Untitled Draft",
    content: content ?? "",
    status: "draft",
    assignment_task_id: resolvedAssignmentTaskId,
    class_id: classId ?? null,
    language_id: resolvedLanguageId,
  };

  if (documentId) {
    return updateDocument(documentId, {
      title: payload.title,
      content: payload.content,
      status: "draft",
      assignment_task_id: payload.assignment_task_id,
      class_id: payload.class_id,
      language_id: payload.language_id,
    });
  }

  return createDocument(payload);
}

export async function uploadDocumentFromFile(userId, role, file) {
  if (!file) {
    return { data: null, error: new Error("No file selected.") };
  }

  try {
    const textContent = await readFileAsText(file);
    const {
      data: uploadData,
      error: uploadError,
      path,
    } = await uploadDocumentFile(userId, file);

    let content = textContent;
    if (uploadError && !textContent) {
      return { data: null, error: uploadError };
    }
    if (path && !textContent) {
      content = `[storage:${path}]`;
    }

    let assignmentTaskId;
    let languageId;
    try {
      assignmentTaskId = await resolveDefaultAssignmentTaskId();
      languageId = await resolveDefaultLanguageId();
    } catch (e) {
      return {
        data: null,
        error: toUserFriendlyDbError(
          e,
          "documents.uploadDocumentFromFile.defaults",
        ),
      };
    }

    return createDocument({
      user_id: userId,
      role,
      title: file.name,
      content,
      status: "draft",
      assignment_task_id: assignmentTaskId,
      language_id: languageId,
    });
  } catch (error) {
    console.error("[Supabase] documents.uploadDocumentFromFile", error);
    return { data: null, error };
  }
}

function readFileAsText(file) {
  return new Promise((resolve) => {
    const textTypes = /\.(txt|md|json|csv|html|css|js|jsx|ts|tsx)$/i;
    if (!textTypes.test(file.name)) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
}

export function downloadDocumentContent(doc) {
  if (!doc?.content) {
    alert("No content available to download.");
    return;
  }
  const blob = new Blob([doc.content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${doc.title || "document"}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// evaluations
// ---------------------------------------------------------------------------

export async function listEvaluations(filters = {}) {
  return safeQuery(async () => {
    let query = supabase.from("evaluations").select("*");
    if (filters.essayId) query = query.eq("essay_id", filters.essayId);
    if (filters.evaluatorId)
      query = query.eq("evaluator_id", filters.evaluatorId);
    return query.order("evaluated_at", { ascending: false });
  }, "evaluations.list");
}

export async function getEvaluationById(id) {
  return safeQuery(
    async () =>
      supabase.from("evaluations").select("*").eq("id", id).maybeSingle(),
    "evaluations.getById",
  );
}

export async function createEvaluation(evaluation) {
  return safeQuery(
    async () =>
      supabase.from("evaluations").insert(evaluation).select().maybeSingle(),
    "evaluations.create",
  );
}

export async function updateEvaluation(id, updates) {
  return safeQuery(
    async () =>
      supabase
        .from("evaluations")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle(),
    "evaluations.update",
  );
}

export async function deleteEvaluation(id) {
  return safeQuery(
    async () => supabase.from("evaluations").delete().eq("id", id),
    "evaluations.delete",
  );
}

/** Creates evaluation + optional feedback in one flow. */
export async function submitEvaluation({
  essayId,
  totalScore,
  suggestions,
  rubricMatrix,
  evaluatorId = null,
  strengths,
  weaknesses,
  feedbackSuggestions,
  status = "scored",
}) {
  try {
    if (!essayId) {
      return { data: null, error: new Error("No essay selected for grading.") };
    }

    const { data: essay, error: essayErr } = await getDocumentById(essayId);
    if (essayErr) return { data: null, error: essayErr };
    if (!essay) {
      return {
        data: null,
        error: new Error("Essay not found. Refresh and try again."),
      };
    }

    const sessionUserId = evaluatorId ?? (await getAuthUserId());
    if (!sessionUserId) {
      return {
        data: null,
        error: new Error("You must be signed in to submit a grade."),
      };
    }

    const numericScore = Number(totalScore);
    if (Number.isNaN(numericScore)) {
      return {
        data: null,
        error: new Error("Please enter a valid numeric score."),
      };
    }
    const clampedScore = Math.max(0, Math.min(10, numericScore));

    // Ensure essayId is treated as a string (UUID) to avoid integer type errors
    const evaluationPayload = {
      essay_id: String(essayId),
      evaluator_id: String(sessionUserId),
      total_score: clampedScore,
      status: status || "scored",
      evaluated_at: new Date().toISOString(),
      suggestions: suggestions ?? null,
      rubric_matrix: rubricMatrix ?? null,
    };

    const { data: evaluation, error: evalError } =
      await createEvaluation(evaluationPayload);

    if (evalError) return { data: null, error: evalError };

    // Update the essay document status to "scored"
    await updateDocument(essayId, { status: "scored" });

    if (strengths || weaknesses || feedbackSuggestions) {
      const { data: feedback, error: fbError } = await createFeedback({
        evaluation_id: evaluation.id,
        strengths: strengths ?? null,
        weaknesses: weaknesses ?? null,
        suggestions: feedbackSuggestions ?? suggestions ?? null,
      });

      if (fbError)
        return { data: { evaluation, feedback: null }, error: fbError };
      return { data: { evaluation, feedback }, error: null };
    }

    return { data: { evaluation, feedback: null }, error: null };
  } catch (error) {
    console.error("[Supabase] evaluations.submitEvaluation", error);
    return { data: null, error };
  }
}

export async function getStudentGradedEssays(userId) {
  return safeQuery(async () => {
    const { data: docs, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", userId)
      .eq("role", "student")
      .eq("status", "graded");

    if (docError) return { data: null, error: docError };

    const enriched = await Promise.all(
      (docs ?? []).map(async (doc) => {
        const { data: evals } = await supabase
          .from("evaluations")
          .select("*, feedback(*)")
          .eq("essay_id", doc.id)
          .eq("status", "released")
          .order("evaluated_at", { ascending: false })
          .limit(1);

        const evaluation = evals?.[0];
        const feedbackRow = evaluation?.feedback?.[0] ?? evaluation?.feedback;

        return {
          id: doc.id,
          title: doc.title,
          subject: doc.class_id ? "Class assignment" : "Essay",
          score: evaluation?.total_score ?? "—",
          gradedDate: evaluation?.evaluated_at
            ? new Date(evaluation.evaluated_at).toLocaleDateString()
            : "—",
          submittedDate: doc.created_at
            ? new Date(doc.created_at).toLocaleString()
            : "—",
          wordCount: doc.content
            ? String(doc.content.trim().split(/\s+/).filter(Boolean).length)
            : "0",
          content: doc.content ?? "",
          feedback:
            feedbackRow?.suggestions ??
            evaluation?.suggestions ??
            "No feedback yet.",
          document: doc,
          evaluation,
        };
      }),
    );

    return { data: enriched.filter((e) => e.evaluation), error: null };
  }, "evaluations.getStudentGradedEssays");
}

// ---------------------------------------------------------------------------
// feedback
// ---------------------------------------------------------------------------

export async function listFeedback(filters = {}) {
  return safeQuery(async () => {
    let query = supabase.from("feedback").select("*");
    if (filters.evaluationId)
      query = query.eq("evaluation_id", filters.evaluationId);
    return query.order("created_at", { ascending: false });
  }, "feedback.list");
}

export async function getFeedbackById(id) {
  return safeQuery(
    async () =>
      supabase.from("feedback").select("*").eq("id", id).maybeSingle(),
    "feedback.getById",
  );
}

export async function createFeedback(feedback) {
  return safeQuery(
    async () =>
      supabase.from("feedback").insert(feedback).select().maybeSingle(),
    "feedback.create",
  );
}

export async function updateFeedback(id, updates) {
  return safeQuery(
    async () =>
      supabase
        .from("feedback")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle(),
    "feedback.update",
  );
}

export async function deleteFeedback(id) {
  return safeQuery(
    async () => supabase.from("feedback").delete().eq("id", id),
    "feedback.delete",
  );
}

// ---------------------------------------------------------------------------
// rubrics, criteria, languages, score_details
// ---------------------------------------------------------------------------

export async function listRubrics(filters = {}) {
  return safeQuery(async () => {
    let query = supabase.from("rubrics").select("*");
    if (filters.assignmentTaskId) {
      query = query.eq("assignment_task_id", filters.assignmentTaskId);
    }
    return query;
  }, "rubrics.list");
}

export async function getRubricById(id) {
  return safeQuery(
    async () => supabase.from("rubrics").select("*").eq("id", id).maybeSingle(),
    "rubrics.getById",
  );
}

export async function createRubric(rubric) {
  return safeQuery(
    async () => supabase.from("rubrics").insert(rubric).select().maybeSingle(),
    "rubrics.create",
  );
}

/** Validates assignment_task_id exists before rubric insert (avoids fk_rubric_assignment). */
export async function createRubricWithValidation(rubric) {
  const taskId = rubric?.assignment_task_id;
  const check = await assertAssignmentTaskExists(taskId);
  if (!check.exists) {
    return { data: null, error: check.error };
  }
  return createRubric({
    ...rubric,
    assignment_task_id: Number(taskId),
  });
}

export async function updateRubric(id, updates) {
  return safeQuery(
    async () =>
      supabase
        .from("rubrics")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle(),
    "rubrics.update",
  );
}

export async function deleteRubric(id) {
  return safeQuery(
    async () => supabase.from("rubrics").delete().eq("id", id),
    "rubrics.delete",
  );
}

export async function listCriteria(rubricId) {
  return safeQuery(
    async () => supabase.from("criteria").select("*").eq("rubric_id", rubricId),
    "criteria.list",
  );
}

export async function getCriteriaById(id) {
  return safeQuery(
    async () =>
      supabase.from("criteria").select("*").eq("id", id).maybeSingle(),
    "criteria.getById",
  );
}

export async function createCriteria(criteria) {
  return safeQuery(
    async () =>
      supabase.from("criteria").insert(criteria).select().maybeSingle(),
    "criteria.create",
  );
}

export async function updateCriteria(id, updates) {
  return safeQuery(
    async () =>
      supabase
        .from("criteria")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle(),
    "criteria.update",
  );
}

export async function deleteCriteria(id) {
  return safeQuery(
    async () => supabase.from("criteria").delete().eq("id", id),
    "criteria.delete",
  );
}

export async function listLanguages() {
  return safeQuery(
    async () =>
      supabase.from("languages").select("*").order("name", { ascending: true }),
    "languages.list",
  );
}

export async function createLanguage(language) {
  return safeQuery(
    async () =>
      supabase.from("languages").insert(language).select().maybeSingle(),
    "languages.create",
  );
}

export async function updateLanguage(id, updates) {
  return safeQuery(
    async () =>
      supabase
        .from("languages")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle(),
    "languages.update",
  );
}

export async function deleteLanguage(id) {
  return safeQuery(
    async () => supabase.from("languages").delete().eq("id", id),
    "languages.delete",
  );
}

export async function listScoreDetails(evaluationId) {
  return safeQuery(
    async () =>
      supabase
        .from("score_details")
        .select("*")
        .eq("evaluation_id", evaluationId),
    "score_details.list",
  );
}

export async function createScoreDetail(scoreDetail) {
  return safeQuery(
    async () =>
      supabase.from("score_details").insert(scoreDetail).select().maybeSingle(),
    "score_details.create",
  );
}

export async function updateScoreDetail(id, updates) {
  return safeQuery(
    async () =>
      supabase
        .from("score_details")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle(),
    "score_details.update",
  );
}

export async function deleteScoreDetail(id) {
  return safeQuery(
    async () => supabase.from("score_details").delete().eq("id", id),
    "score_details.delete",
  );
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function isStorageBucketNotFound(error) {
  const message = (error?.message ?? "").toLowerCase();
  const status = error?.status ?? error?.statusCode;
  return (
    message.includes("bucket not found") || status === 404 || status === "404"
  );
}

function formatStorageError(error, bucket) {
  if (isStorageBucketNotFound(error)) {
    console.error(
      `Check Supabase Dashboard: Bucket ${bucket} must be created.`,
    );
    return new Error(
      `Check Supabase Dashboard: Bucket "${bucket}" must be created.`,
    );
  }
  return error;
}

export async function uploadDocumentFile(userId, file) {
  if (!file)
    return { data: null, error: new Error("No file provided."), path: null };

  const path = `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  try {
    const result = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (result.error) {
      const formatted = formatStorageError(result.error, DOCUMENTS_BUCKET);
      logSupabaseError(
        {
          code: result.error.name,
          message: formatted.message,
          details: null,
          hint: null,
        },
        "storage.uploadDocumentFile",
      );
      return { data: null, error: formatted, path: null };
    }
    return { ...result, path };
  } catch (error) {
    console.error("[Supabase] storage.uploadDocumentFile", error);
    return { data: null, error, path: null };
  }
}

export async function downloadDocumentFile(filePath) {
  try {
    const result = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .download(filePath);
    if (result.error)
      logSupabaseError(result.error, "storage.downloadDocumentFile");
    return result;
  } catch (error) {
    return { data: null, error };
  }
}

function sanitizeFileName(name) {
  return (name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Upload profile picture to avatars bucket and persist URL on users.avatar_url.
 */
export async function uploadProfilePic(userId, file) {
  if (!file || !userId) {
    return {
      data: null,
      url: null,
      error: new Error("User and file are required."),
    };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/avatar.${ext}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: true });

    if (uploadError) {
      const formatted = formatStorageError(uploadError, AVATARS_BUCKET);
      return { data: null, url: null, error: formatted };
    }

    const { data: publicData } = supabase.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(path);
    const url = publicData?.publicUrl
      ? `${publicData.publicUrl}?t=${Date.now()}`
      : null;

    if (url) {
      await updateUserProfile(userId, { avatar_url: url });
    }

    return { data: { path }, url, error: null };
  } catch (error) {
    console.error("[Supabase] storage.uploadProfilePic", error);
    return { data: null, url: null, error };
  }
}

export async function getProfileAvatarUrl(userId) {
  if (!userId) return { url: null, error: null };

  const { data: profile } = await getUserProfile(userId);
  if (profile?.avatar_url) {
    return { url: profile.avatar_url, error: null };
  }

  const { data: files, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .list(userId, {
      limit: 1,
      sortBy: { column: "updated_at", order: "desc" },
    });

  if (error || !files?.length) {
    return { url: null, error };
  }

  const path = `${userId}/${files[0].name}`;
  const { data: publicData } = supabase.storage
    .from(AVATARS_BUCKET)
    .getPublicUrl(path);
  const url = publicData?.publicUrl ?? null;
  return { url, error: null };
}

/**
 * Release grade to student: marks essay as graded (visible on student dashboard).
 */
export async function releaseScore(evaluationId) {
  console.log("releaseScore called with evaluationId:", evaluationId);
  try {
    console.log("Calling getEvaluationById...");
    const { data: evaluation, error: evalError } =
      await getEvaluationById(evaluationId);
    console.log("getEvaluationById result:", {
      data: evaluation,
      error: evalError,
    });
    if (evalError) return { data: null, error: evalError };
    if (!evaluation?.essay_id) {
      return {
        data: null,
        error: new Error("Evaluation has no linked essay."),
      };
    }
    console.log("Found evaluation:", evaluation);

    console.log("Calling updateEvaluation to set status to released...");
    const { data: releasedEval, error: releaseError } = await updateEvaluation(
      evaluationId,
      {
        status: "released",
      },
    );
    console.log("updateEvaluation result:", {
      data: releasedEval,
      error: releaseError,
    });
    if (releaseError) return { data: null, error: releaseError };

    console.log(
      "Calling updateDocument to set status to graded for essay_id:",
      evaluation.essay_id,
    );
    const { data: doc, error: docError } = await updateDocument(
      evaluation.essay_id,
      {
        status: "graded",
      },
    );
    console.log("updateDocument result:", { data: doc, error: docError });
    if (docError) return { data: null, error: docError };

    console.log("releaseScore returning successfully!");
    return {
      data: { evaluation: releasedEval ?? evaluation, document: doc },
      error: null,
    };
  } catch (error) {
    console.error("[Supabase] releaseScore", error);
    return { data: null, error };
  }
}

// ---------------------------------------------------------------------------
// Connection test
// ---------------------------------------------------------------------------

export async function testSupabaseConnection() {
  const { session, error: sessionError } = await getSession();
  if (sessionError) {
    return {
      ok: false,
      message: "Auth session check failed.",
      details: sessionError,
    };
  }

  const { data, error } = await listAssignmentTasks();
  if (error) {
    return {
      ok: false,
      message: isRlsError(error)
        ? "RLS blocked database read. Run supabase/rls_policies.sql."
        : "Database read failed.",
      details: error,
    };
  }

  return {
    ok: true,
    message: session
      ? `Connected as ${session.user.email}. ${data?.length ?? 0} assignment(s).`
      : `Connected. ${data?.length ?? 0} assignment(s).`,
    details: { rowCount: data?.length ?? 0 },
  };
}

export { supabase };
