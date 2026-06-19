import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getSession,
  getUserProfile,
  fetchTeacherSubmissions,
  createAssignmentTask,
  createRubricWithValidation,
  fetchTeacherAssignmentTasks,
  updateAssignmentTask,
  deleteAssignmentTask,
  listAssignmentTasks,
  listClasses,
  listEvaluations,
  createClass,
  updateClass,
  deleteClass,
} from "../../services/api.js";
import AppPageHeader from "../../components/AppPageHeader.jsx";
import SidebarNav from "../../components/SidebarNav.jsx";
import SidebarProfileRow from "../../components/SidebarProfileRow.jsx";
import { formatDocumentStatus } from "../../utils/statusDisplay.js";

export default function Teacher_Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab] = useState("Dashboard");
  const [userName, setUserName] = useState("Teacher");
  const [stats, setStats] = useState({ graded: 0, pending: 0, flagged: 0 });
  const [submissions, setSubmissions] = useState([]);
  const [teacherTasks, setTeacherTasks] = useState([]);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [classes, setClasses] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassData, setNewClassData] = useState({
    class_name: "",
    section: "",
    subject: "",
  });
  const [editingClassId, setEditingClassId] = useState(null);
  const dropdownRef = useRef(null);

  const sidebarItems = [
    "Dashboard",
    "Documents",
    "Grade Essays",
    "Trash",
    "Settings",
  ];

  // Centralized router handling using proper URL path strings
  const handleNavigation = (item) => {
    if (item === "Dashboard") navigate("/teacher_dashboard");
    if (item === "Documents") navigate("/teacher_documents");
    if (item === "Trash") navigate("/teacher_trash");
    if (item === "Grade Essays") navigate("/teacher_grade_essay");
    if (item === "Settings") navigate("/teacher_settings");
  };

  const loadData = useCallback(async () => {
    const { session } = await getSession();
    if (!session) {
      navigate("/sign_in");
      return;
    }
    const { data: profile } = await getUserProfile(session.user.id);
    setUserName(profile?.full_name || "Teacher");

    // Use selectedClass for submissions - fetch all statuses (submitted, scored, graded)
    const params = {
      ...(selectedClass?.id && { classId: selectedClass.id }),
    };
    const { data: allDocs } = await fetchTeacherSubmissions(
      session.user.id,
      params,
    );

    // Separate documents by status
    const pendingDocs = (allDocs ?? []).filter(
      (doc) => doc.status === "submitted",
    );
    const scoredDocs = (allDocs ?? []).filter((doc) => doc.status === "scored");
    const gradedDocs = (allDocs ?? []).filter((doc) => doc.status === "graded");

    setStats({
      graded: gradedDocs?.length ?? 0,
      pending: pendingDocs?.length ?? 0,
      flagged: scoredDocs?.length ?? 0,
    });

    const pendingRows = await Promise.all(
      (pendingDocs ?? []).map(async (doc) => {
        const { data: student } = await getUserProfile(doc.user_id);
        return {
          id: doc.id,
          studentName: student?.full_name ?? "Student",
          title: doc.title,
          score: doc.score ?? "—",
          status: formatDocumentStatus(doc.status),
          rawStatus: doc.status,
        };
      }),
    );

    const scoredRows = await Promise.all(
      (scoredDocs ?? []).map(async (doc) => {
        const { data: student } = await getUserProfile(doc.user_id);
        // Get evaluation (doesn't need to be released)
        const { data: evaluations } = await listEvaluations({
          essayId: doc.id,
        });
        const evaluation = evaluations?.[0];

        return {
          id: doc.id,
          studentName: student?.full_name ?? "Student",
          title: doc.title,
          score:
            evaluation?.total_score != null
              ? evaluation.total_score
              : (doc.score ?? "—"),
          status: formatDocumentStatus(doc.status),
          rawStatus: doc.status,
        };
      }),
    );

    const gradedRows = await Promise.all(
      (gradedDocs ?? []).map(async (doc) => {
        const { data: student } = await getUserProfile(doc.user_id);
        const { data: evaluations } = await listEvaluations({
          essayId: doc.id,
          status: "released",
        });
        const evaluation = evaluations?.[0];

        return {
          id: doc.id,
          studentName: student?.full_name ?? "Student",
          title: doc.title,
          score:
            evaluation?.total_score != null
              ? evaluation.total_score
              : (doc.score ?? "—"),
          status: formatDocumentStatus(doc.status),
          rawStatus: doc.status,
        };
      }),
    );

    setSubmissions([...pendingRows, ...scoredRows, ...gradedRows]);

    const { data: tasks } = await fetchTeacherAssignmentTasks(session.user.id);
    setTeacherTasks(tasks ?? []);

    const { data: cls } = await listClasses({ teacherId: session.user.id });
    setClasses(cls ?? []);
  }, [navigate, selectedClass]);

  useEffect(() => {
    // Initial load, reload when location changes, or selected class changes
    loadData();
  }, [location.pathname, selectedClass, loadData]);

  useEffect(() => {
    // Reload data when the page is visible, honoring the current class filter
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedClass, loadData]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openCreateModal = () => {
    setEditingClassId(null);
    setNewClassData({ class_name: "", section: "", subject: "" });
    setShowCreateModal(true);
  };

  const handleSaveClass = async () => {
    const { class_name, section, subject } = newClassData;
    if (!class_name.trim()) return alert("Please enter a class name");
    const { session } = await getSession();
    const payload = {
      class_name: class_name.trim(),
      section: section.trim() || null,
      subject: subject.trim() || null,
      teacher_id: session?.user?.id ?? null,
    };

    if (editingClassId) {
      const { error, data } = await updateClass(editingClassId, payload);
      if (error) return alert(error.message || "Unable to update class");
      setClasses((prev) => prev.map((c) => (c.id === data.id ? data : c)));
      setSelectedClass(data);
    } else {
      const { data, error } = await createClass(payload);
      if (error) return alert(error.message || "Unable to create class");
      setClasses((prev) => [data, ...prev]);
      setSelectedClass(data);
    }

    setShowCreateModal(false);
  };

  const handleEditClass = (cls) => {
    setEditingClassId(cls.id);
    setNewClassData({
      class_name: cls.class_name || "",
      section: cls.section || "",
      subject: cls.subject || "",
    });
    setShowCreateModal(true);
  };

  const handleDeleteClass = async (cls) => {
    if (!window.confirm(`Delete class "${cls.class_name}"?`)) return;
    const { error } = await deleteClass(cls.id);
    if (error) return alert(error.message || "Unable to delete class");
    setClasses((prev) => prev.filter((c) => c.id !== cls.id));
    if (selectedClass?.id === cls.id) setSelectedClass(null);
  };

  const handleUploadEssays = async () => {
    const title = window.prompt("New assignment title:");
    if (!title) return;
    const instruction = window.prompt("Instructions:") || "";
    const { session } = await getSession();
    const { error } = await createAssignmentTask({
      title,
      instruction,
      created_by: session?.user?.id ?? null,
      status: "active",
    });
    if (error) alert(error.message);
    else {
      alert("Assignment created.");
      loadData();
    }
  };

  const handleUploadRubric = async () => {
    const { data: tasks } = await listAssignmentTasks();
    if (!tasks?.length) {
      alert("Create an assignment first before uploading a rubric.");
      return;
    }
    const taskList = tasks.map((t) => `${t.id}: ${t.title}`).join("\n");
    const taskId = window.prompt(`Assignment task ID:\n${taskList}`);
    const name = window.prompt("Rubric name:");
    if (!taskId || !name) return;
    const { error } = await createRubricWithValidation({
      assignment_task_id: Number(taskId),
      name,
      description: "",
    });
    if (error) alert(error.message);
    else alert("Rubric created.");
  };

  const handleEditTask = async (task) => {
    navigate("/teacher_create_task", {
      state: { selectedClass, editingTask: task },
    });
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    const { error } = await deleteAssignmentTask(task.id);
    if (error) alert(error.message);
    else loadData();
  };

  const handleCopyClassCode = (classCode) => {
    navigator.clipboard
      .writeText(classCode)
      .then(() => {
        alert("Class code copied to clipboard!");
      })
      .catch(() => {
        alert("Failed to copy class code");
      });
  };

  const handleExportGrades = () => {
    if (!submissions.length) return;
    const csv = [
      ["Student", "Essay", "Status", "Score"].join(","),
      ...submissions.map((s) =>
        [s.studentName, s.title, s.status, s.score].join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grades-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#c5ecff] pt-6 pr-6 font-sans overflow-hidden box-border gap-0">
      <AppPageHeader showSearch={false} />

      {/* MAIN CONTAINER LAYOUT */}
      <div className="flex flex-1 w-full gap-8 overflow-hidden">
        {/* LEFT SIDEBAR PANEL */}
        <div className="w-[400px] bg-[#7ba4cc] h-full flex flex-col justify-between py-8 pl-4 relative shadow-[5px_0_15px_rgba(0,0,0,0.05)] rounded-tr-2xl">
          <div className="flex flex-col w-full">
            <SidebarNav
              items={sidebarItems}
              activeTab={activeTab}
              onNavigate={handleNavigation}
            />
          </div>

          <SidebarProfileRow />
        </div>

        {/* RIGHT CONTENT WORKSPACE */}
        <div className="flex-1 h-full flex flex-col gap-6 overflow-y-auto scrollbar-custom box-border pr-2 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-page-title">Welcome back, {userName}!</h1>
              <p className="text-xs text-[#475569] tracking-wide">
                {selectedClass
                  ? `Viewing dashboard for: ${selectedClass.class_name || selectedClass.name}`
                  : "Select a class to view your tasks and submissions."}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {!selectedClass ? (
                <button
                  onClick={openCreateModal}
                  className="bg-white text-slate-800 font-medium py-2.5 px-6 border border-[#cbd5e1] rounded-xl shadow-sm cursor-pointer text-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-95"
                >
                  Create New Class
                </button>
              ) : (
                <button
                  onClick={() => setSelectedClass(null)}
                  className="text-sm text-blue-600 underline w-fit cursor-pointer transition-all duration-200 hover:text-blue-700 hover:opacity-80 active:scale-95"
                >
                  ← Back to Classes
                </button>
              )}
            </div>
          </div>

          {!selectedClass ? (
            /* LANDING VIEW */
            <div className="flex flex-col gap-6 pt-4">
              <div className="flex items-center">
                <h2 className="text-base font-semibold text-[#1e293b]">
                  Classes
                </h2>
              </div>
              {classes.length === 0 ? (
                <div className="w-full h-80 flex flex-col items-center justify-center bg-[#c5ecff] rounded-xl text-black">
                  <h2 className="text-4xl font-semibold tracking-wide">
                    No Classes
                  </h2>
                  <p className="mt-1 text-sm font-medium text-gray-800">
                    Classes you have will display here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {classes.map((c) => (
                    <div
                      key={c.id}
                      className="w-full h-56 bg-white rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow flex flex-col relative overflow-visible"
                    >
                      <div
                        onClick={() => setSelectedClass(c)}
                        className="flex flex-col flex-grow"
                      >
                        <div className="bg-[#7ba4cc] p-4 h-28 rounded-t-xl flex flex-col justify-end gap-2">
                          <h3 className="font-bold text-lg text-white truncate">
                            {c.class_name || c.name}
                          </h3>
                          <p className="text-sm text-white/90 truncate">
                            {c.section || c.subject || "No Section"}
                          </p>
                        </div>
                        <div className="flex-grow p-4">
                          <p className="text-sm text-slate-500">
                            {c.subject
                              ? `Subject: ${c.subject}`
                              : c.section
                                ? `Section: ${c.section}`
                                : "No subject added yet"}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 p-2 flex justify-end relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(
                              activeMenuId === `class-${c.id}`
                                ? null
                                : `class-${c.id}`,
                            );
                          }}
                          className="text-slate-600 font-bold text-lg hover:text-slate-900 px-2"
                        >
                          ...
                        </button>

                        {activeMenuId === `class-${c.id}` && (
                          <div className="absolute bottom-full right-3 mb-2 z-30 w-36 bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyClassCode(c.class_code);
                                setActiveMenuId(null);
                              }}
                              className="px-4 py-2 text-sm text-left hover:bg-gray-200 rounded-t-xl"
                            >
                              Copy Code
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClass(c);
                                setActiveMenuId(null);
                              }}
                              className="px-4 py-2 text-sm text-left hover:bg-gray-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClass(c);
                                setActiveMenuId(null);
                              }}
                              className="px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 rounded-b-xl"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* DASHBOARD VIEW */
            <div className="flex flex-col gap-6">
              {/* Your assignments */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#1e293b]">
                    Your assignments
                  </h2>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() =>
                        navigate("/teacher_create_task", {
                          state: { selectedClass },
                        })
                      }
                      className="bg-white text-slate-800 font-medium py-2.5 px-6 border border-[#cbd5e1] rounded-xl shadow-sm text-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-95"
                    >
                      Create Task
                    </button>
                  </div>
                </div>
                {(() => {
                  // Filter tasks to only show those for the selected class
                  const filteredTasks = teacherTasks.filter(
                    (task) =>
                      task.class_id === selectedClass.id ||
                      task.class_id === null,
                  );

                  if (filteredTasks.length === 0) {
                    return (
                      <p className="text-sm text-slate-500 italic">
                        No tasks yet for this class.
                      </p>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {filteredTasks.map((task) => {
                        let dueDateText = "No due date set";
                        if (task.due_date) {
                          const date = new Date(task.due_date);
                          if (!isNaN(date.getTime())) {
                            dueDateText = date.toLocaleString("en-US", {
                              month: "numeric",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            });
                          }
                        }
                        return (
                          <div
                            key={task.id}
                            className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-sm w-full relative flex flex-col justify-between min-h-[100px]"
                          >
                            <div>
                              <p className="font-semibold text-slate-800 mb-1">
                                {task.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                {task.due_date
                                  ? `Due ${dueDateText}`
                                  : "No due date set"}
                              </p>
                            </div>
                            <div
                              className="absolute bottom-3 right-3"
                              ref={
                                activeMenuId === task.id ? dropdownRef : null
                              }
                            >
                              <button
                                onClick={() =>
                                  setActiveMenuId(
                                    activeMenuId === task.id ? null : task.id,
                                  )
                                }
                                className="text-slate-400 font-bold text-lg cursor-pointer transition-all duration-200 hover:text-slate-600 hover:scale-110 active:scale-95"
                              >
                                ...
                              </button>
                              {activeMenuId === task.id && (
                                <div className="absolute top-0 right-full z-30 w-24 bg-white border border-slate-200 rounded-lg shadow-xl flex flex-col">
                                  <button
                                    onClick={() => {
                                      handleEditTask(task);
                                      setActiveMenuId(null);
                                    }}
                                    className="px-4 py-2 text-sm text-left cursor-pointer transition-all duration-200 hover:bg-gray-200 rounded-t-lg"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleDeleteTask(task);
                                      setActiveMenuId(null);
                                    }}
                                    className="px-4 py-2 text-sm text-left text-red-600 cursor-pointer transition-all duration-200 hover:bg-red-50 rounded-b-lg"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Class Overview */}
              <div className="flex flex-col gap-2">
                <h2 className="text-base font-semibold text-[#1e293b] tracking-wide">
                  Class Overview
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    { label: "Total Released", val: stats.graded },
                    { label: "Pending", val: stats.pending },
                    { label: "Graded (Not Released)", val: stats.flagged },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="bg-white border border-[#cbd5e1] rounded-xl p-5 shadow-sm h-28 flex flex-col justify-start"
                    >
                      <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider text-center w-full">
                        {s.label}
                      </span>
                      <span className="text-3xl font-bold text-center text-[#1e293b] mt-2">
                        {s.val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Student Submission List */}
              <div className="flex-1 flex flex-col gap-2 min-h-[250px]">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#1e293b] tracking-wide">
                    Student Submission List
                  </h2>
                  <button
                    onClick={handleExportGrades}
                    disabled={!submissions.length}
                    className="bg-white text-slate-800 font-medium py-1.5 px-4 border border-[#cbd5e1] rounded-lg shadow-sm text-xs cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Export Grades
                  </button>
                </div>
                <div className="w-full flex-1 bg-white border border-[#cbd5e1] rounded-xl shadow-sm overflow-hidden flex flex-col">
                  <table className="w-full border-collapse">
                    <thead className="bg-slate-50 border-b border-[#cbd5e1]">
                      <tr>
                        <th className="py-3 px-6 text-sm font-semibold text-[#334155]">
                          Student Name
                        </th>
                        <th className="py-3 px-6 text-sm font-semibold text-[#334155] text-center">
                          Score
                        </th>
                        <th className="py-3 px-6 text-sm font-semibold text-[#334155] text-center">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.length === 0 ? (
                        <tr className="text-slate-400 text-sm italic text-center">
                          <td colSpan="3" className="py-10">
                            No active student submissions loaded yet.
                          </td>
                        </tr>
                      ) : (
                        submissions.map((row) => (
                          <tr
                            key={row.id}
                            onClick={() =>
                              navigate("/teacher_grade_essay", {
                                state: { essayId: row.id },
                              })
                            }
                            className="border-b border-[#cbd5e1] hover:bg-slate-50 cursor-pointer"
                          >
                            <td className="py-3 text-center px-6 text-sm text-slate-700">
                              {row.studentName}
                            </td>
                            <td className="py-3 px-6 text-sm text-emerald-500 text-center">
                              {row.score}
                            </td>
                            <td className="py-3 text-center px-6 text-sm">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                  row.rawStatus === "submitted"
                                    ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                                    : row.rawStatus === "scored"
                                      ? "bg-blue-100 text-blue-800 border border-blue-200"
                                      : row.rawStatus === "graded"
                                        ? "bg-green-100 text-green-800 border border-green-200"
                                        : "bg-slate-100 text-slate-800 border border-slate-200"
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="absolute inset-0 bg-black/40"></div>
          <div
            className="relative bg-white rounded-xl shadow-xl w-[560px] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-4">
              {editingClassId ? "Edit Class" : "Create Class"}
            </h3>
            <div className="flex flex-col gap-3">
              <input
                value={newClassData.class_name}
                onChange={(e) =>
                  setNewClassData((s) => ({ ...s, class_name: e.target.value }))
                }
                placeholder="Class Name"
                className="px-3 py-2 border rounded-md"
              />
              <input
                value={newClassData.section}
                onChange={(e) =>
                  setNewClassData((s) => ({ ...s, section: e.target.value }))
                }
                placeholder="Section"
                className="px-3 py-2 border rounded-md"
              />
              <input
                value={newClassData.subject}
                onChange={(e) =>
                  setNewClassData((s) => ({ ...s, subject: e.target.value }))
                }
                placeholder="Subject"
                className="px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="bg-white text-slate-800 font-medium py-2.5 px-6 border border-[#cbd5e1] rounded-xl shadow-sm cursor-pointer text-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveClass}
                className="bg-white text-slate-800 font-medium py-2.5 px-6 border border-[#cbd5e1] rounded-xl shadow-sm cursor-pointer text-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-95"
              >
                {editingClassId ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
