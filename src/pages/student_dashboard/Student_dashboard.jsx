import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getSession,
  getUserProfile,
  fetchStudentTodoTasks,
  getStudentGradedEssays,
  submitDocument,
  getDocuments,
  getClassByCode,
  joinClass,
  unenrollFromClass,
  getStudentClasses,
} from "../../services/api.js";
import AppPageHeader from "../../components/AppPageHeader.jsx";
import SidebarNav from "../../components/SidebarNav.jsx";
import SidebarProfileRow from "../../components/SidebarProfileRow.jsx";

export default function Student_Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab] = useState("Dashboard");
  const [userName, setUserName] = useState("Student");
  const [todoTasks, setTodoTasks] = useState([]);
  const [gradedEssays, setGradedEssays] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [classes, setClasses] = useState([]); // Array to hold joined classes
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [classCode, setClassCode] = useState("");

  // Detail View Active Overlays State
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedEssay, setSelectedEssay] = useState(null);

  // Structural student navigation tabs
  const sidebarItems = ["Dashboard", "Documents", "Trash", "Settings"];

  const handleNavigation = (item) => {
    if (item === "Dashboard") navigate("/student_dashboard");
    if (item === "Documents") navigate("/student_documents");
    if (item === "Trash") navigate("/student_trash");
    if (item === "Settings") navigate("/student_settings");
  };

  // Triggers navigation to the essay editor while securely pushing task context metadata
  const handleOpenEditor = () => {
    if (selectedTask) {
      navigate("/student_essay_editor", {
        state: {
          taskId: selectedTask.id,
          title: selectedTask.title,
          subject: selectedTask.subject,
          instructions: selectedTask.instructions,
          dueDate: selectedTask.rawDueDate,
        },
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedTask) return;
    try {
      setSubmitting(true);
      const { session } = await getSession();
      if (!session) return;
      const { data: docs } = await getDocuments({
        userId: session.user.id,
        role: "student",
        assignmentTaskId: selectedTask.id,
      });
      const draft = docs?.find((d) => d.status === "draft") ?? docs?.[0];
      if (!draft) {
        alert("Create and save a draft in the editor before submitting.");
        return;
      }
      const { error } = await submitDocument(draft.id);
      if (error) throw error;
      alert("Submitted successfully.");
      setSelectedTask(null);
      await loadAllData(); // Reload all data
    } catch (err) {
      alert(err.message || "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const [sessionUserId, setSessionUserId] = useState(null);

  const loadClasses = async (userId) => {
    const { data } = await getStudentClasses(userId);
    if (data) {
      const mappedClasses = data.map((sc) => ({
        ...sc.class,
        id: sc.class.id,
        teacherName: sc.class.teacher?.full_name || "Teacher",
        teacherAvatarUrl: sc.class.teacher?.avatar_url || null,
      }));
      setClasses(mappedClasses);
    }
  };

  const loadAllData = async () => {
    const { session } = await getSession();
    if (!session) {
      navigate("/sign_in");
      return;
    }
    setSessionUserId(session.user.id);
    const { data: profile } = await getUserProfile(session.user.id);
    setUserName(profile?.full_name || "Student");

    await loadClasses(session.user.id);

    const { data: tasks } = await fetchStudentTodoTasks(session.user.id);
    const mappedTasks = (tasks ?? []).map((t) => {
      let dueDateText = "—";
      let isOverdue = false;
      let rawDueDate = t.due_date;
      if (t.due_date) {
        const date = new Date(t.due_date);
        if (!isNaN(date.getTime())) {
          isOverdue = date < new Date();
          dueDateText = date.toLocaleString("en-US", {
            month: "numeric",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
        }
      } else if (t.created_at) {
        const date = new Date(t.created_at);
        dueDateText = date.toLocaleDateString();
      }
      return {
        id: t.id,
        title: t.title,
        subject: "Assignment",
        dueDate: dueDateText,
        rawDueDate,
        isOverdue,
        instructions: t.instruction || "No instructions provided.",
        class_id: t.class_id,
        attachments: t.attachments || [],
        links: t.links || [],
      };
    });
    setAllTasks(mappedTasks);
    // Apply selected class filter
    if (selectedClass) {
      setTodoTasks(
        mappedTasks.filter(
          (task) =>
            task.class_id === selectedClass.id || task.class_id === null,
        ),
      );
    } else {
      setTodoTasks(mappedTasks);
    }

    const { data: graded } = await getStudentGradedEssays(session.user.id);
    setGradedEssays(graded ?? []);
  };

  const openJoinModal = () => {
    setClassCode("");
    setShowJoinModal(true);
  };

  const handleJoinClass = async () => {
    if (!classCode.trim()) {
      alert("Please enter a class code before joining.");
      return;
    }
    if (!sessionUserId) return;

    const { data: cls, error } = await getClassByCode(
      classCode.trim().toUpperCase(),
    );
    if (error || !cls) {
      alert("Invalid class code. Please check and try again.");
      return;
    }

    const { error: joinError } = await joinClass(sessionUserId, cls.id);
    if (joinError) {
      alert("You're already in this class or failed to join.");
      return;
    }

    await loadClasses(sessionUserId);
    setShowJoinModal(false);
    setClassCode("");
  };

  const handleUnenroll = async (cls) => {
    if (!window.confirm(`Unenroll from ${cls.class_name}?`)) return;
    if (!sessionUserId) return;

    await unenrollFromClass(sessionUserId, cls.id);
    await loadClasses(sessionUserId);

    if (selectedClass?.id === cls.id) {
      setSelectedClass(null);
    }
    setActiveMenuId(null);
  };

  const [allTasks, setAllTasks] = useState([]); // Store all tasks to filter later

  useEffect(() => {
    loadAllData();
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (selectedClass) {
      setTodoTasks(
        allTasks.filter(
          (task) =>
            task.class_id === selectedClass.id || task.class_id === null,
        ),
      );
    } else {
      setTodoTasks(allTasks);
    }
  }, [selectedClass, allTasks]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        !event.target.closest("[data-class-menu]") &&
        !event.target.closest("[data-class-menu-btn]")
      ) {
        setActiveMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadAllData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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
        <div className="flex-1 h-full flex flex-col gap-6 overflow-y-auto box-border pr-2 pb-6">
          {/* DETAILED OVERLAY PANEL FOR CLICKED TO-DO TASKS */}
          {selectedTask ? (
            <div className="flex flex-col w-full relative animate-fadeIn pr-4">
              {/* Core Headings Frame */}
              <div className="flex items-start justify-between w-full">
                <div className="flex flex-col">
                  <h1 className="text-[54px] font-bold text-[#1e293b] tracking-tight leading-none">
                    Welcome back, {userName}!
                  </h1>
                  <p className="text-sm font-semibold text-slate-600 mt-1.5 ml-0.5">
                    Here's what's happening with your tasks.
                  </p>
                </div>

                {/* ✕ Button placed OUTSIDE the card layout container */}
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-slate-700 hover:text-slate-900 font-bold text-xl mt-4 mr-2 cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Main Rounded White Content Frame Panel */}
              <div className="bg-white border border-[#cbd5e1]/50 rounded-2xl shadow-sm p-8 mt-6 flex flex-col min-h-[300px]">
                <div className="flex items-baseline justify-between border-b border-slate-100 pb-4">
                  <div className="flex flex-col">
                    <h2 className="text-3xl font-bold text-slate-800 tracking-tight">
                      {selectedTask.title}
                    </h2>
                    <span className="text-base font-medium text-slate-500 mt-0.5">
                      {selectedTask.subject}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-semibold px-3 py-1 rounded-full ${
                      selectedTask.isOverdue
                        ? "text-white bg-red-600 border border-red-700"
                        : "text-slate-600 bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {selectedTask.isOverdue ? "Missed" : selectedTask.dueDate}
                  </span>
                </div>

                <div className="mt-6 flex flex-col gap-2">
                  <span className="text-sm font-bold text-slate-400 tracking-wide uppercase">
                    Instructions:
                  </span>
                  <p className="text-base text-slate-600 leading-relaxed font-normal">
                    {selectedTask.instructions}
                  </p>
                </div>

                {/* Attachments */}
                {selectedTask.attachments &&
                  selectedTask.attachments.length > 0 && (
                    <div className="mt-6 flex flex-col gap-2">
                      <span className="text-sm font-bold text-slate-400 tracking-wide uppercase">
                        Attachments:
                      </span>
                      <div className="flex flex-col gap-2">
                        {selectedTask.attachments.map((attachment, idx) => (
                          <a
                            key={idx}
                            href={attachment.url || attachment}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline text-base font-medium"
                          >
                            📎 {attachment.name || "Attachment " + (idx + 1)}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Links */}
                {selectedTask.links && selectedTask.links.length > 0 && (
                  <div className="mt-6 flex flex-col gap-2">
                    <span className="text-sm font-bold text-slate-400 tracking-wide uppercase">
                      Links:
                    </span>
                    <div className="flex flex-col gap-2">
                      {selectedTask.links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url || link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline text-base font-medium"
                        >
                          {link.name || link.url || link}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Open Editor & Submit Action buttons */}
              <div className="flex items-center justify-end gap-4 mt-6">
                <button
                  onClick={handleOpenEditor}
                  className="bg-white border border-slate-200 text-slate-700 font-medium py-2 px-6 rounded-xl shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all duration-150 cursor-pointer"
                >
                  Open Editor
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-white border border-slate-200 text-slate-700 font-medium py-2 px-6 rounded-xl shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all duration-150 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          ) : /* DETAILED OVERLAY PANEL FOR CLICKED RECENT GRADED ESSAYS */
          selectedEssay ? (
            <div className="flex flex-col gap-4 animate-fadeIn pr-4 relative">
              <div className="flex items-start justify-between w-full">
                <div className="flex flex-col">
                  <h1 className="text-[54px] font-bold text-[#1e293b] tracking-tight leading-none">
                    {selectedEssay.title}
                  </h1>
                  <p className="text-sm font-medium text-slate-600 mt-2 ml-0.5">
                    {selectedEssay.subject} . Submitted:{" "}
                    {selectedEssay.submittedDate} . {selectedEssay.wordCount}{" "}
                    words
                  </p>
                </div>

                <button
                  onClick={() => setSelectedEssay(null)}
                  className="text-slate-700 hover:text-slate-900 font-bold text-xl mt-4 mr-2 cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mt-4">
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-8 shadow-sm min-h-[400px] text-slate-700 leading-relaxed font-normal text-base whitespace-pre-wrap">
                  {selectedEssay.content}
                </div>

                <div className="flex flex-col gap-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm min-h-[120px]">
                    <h3 className="text-xl font-bold text-slate-400 tracking-tight mb-2">
                      Score
                    </h3>
                    <span className="text-4xl font-extrabold text-emerald-600">
                      {selectedEssay.score}
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm min-h-[250px]">
                    <h3 className="text-xl font-bold text-slate-400 tracking-tight mb-2">
                      Feedback
                    </h3>
                    <p className="text-slate-600 font-normal text-sm leading-relaxed">
                      {selectedEssay.feedback ||
                        "No feedback structural comments assigned yet."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : /* BASE DASHBOARD LAYOUT GRID ROOT VIEW */
          selectedClass ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-[54px] font-bold text-[#1e293b] tracking-tight leading-none">
                    Welcome back, {userName}!
                  </h1>
                  <p className="text-xs text-slate-600 ml-0.5">
                    Dashboard for {selectedClass.class_name}.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedClass(null)}
                  className="text-sm text-blue-600 underline w-fit cursor-pointer transition-all duration-200 hover:text-blue-700 hover:opacity-80 active:scale-95"
                >
                  ← Back to Classes
                </button>
              </div>

              {/* TO-DO ASSIGNMENT BLOCK */}
              <div className="flex flex-col gap-2 w-full">
                <h3 className="text-xl font-bold text-slate-700 tracking-tight">
                  To do
                </h3>

                {todoTasks.length === 0 ? (
                  <div className="bg-white border border-[#cbd5e1]/50 rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col min-h-[140px] items-center justify-center p-4 text-slate-400 italic text-sm">
                    No tasks assigned yet.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-4">
                    {todoTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="bg-white border border-[#cbd5e1]/50 rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col cursor-pointer hover:border-slate-400 transition duration-150 w-full sm:w-[calc(50%-0.5rem)] max-w-md"
                      >
                        <div className="flex items-start justify-between p-4 border-b border-slate-100 bg-slate-50/30">
                          <div className="flex flex-col">
                            <span className="text-xl font-bold text-slate-800 tracking-tight">
                              {task.title}
                            </span>
                            <span className="text-sm font-medium text-slate-500 mt-0.5">
                              {task.subject}
                            </span>
                          </div>
                          <span
                            className={`text-xs font-semibold px-3 py-1 rounded-full ${
                              task.isOverdue
                                ? "text-red-700 bg-red-600/20"
                                : "text-slate-600 bg-slate-100 border border-slate-200"
                            }`}
                          >
                            {task.isOverdue
                              ? "Missed"
                              : (task.dueDate || "").split(",")[0]}
                          </span>
                        </div>
                        <div className="p-4 bg-white">
                          <p className="text-sm text-slate-600 font-normal truncate">
                            {task.instructions}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RECENT GRADED ESSAYS GRID SYSTEM TABLE */}
              <div className="flex flex-col gap-2 w-full mt-2">
                <h3 className="text-xl font-bold text-slate-700 tracking-tight">
                  Recent Graded Essay
                </h3>

                <div className="w-full bg-white border border-[#cbd5e1]/50 rounded-xl shadow-sm overflow-hidden max-h-[220px] flex flex-col">
                  <div className="grid grid-cols-3 border-b border-[#cbd5e1]/40 bg-slate-50/50 text-slate-500 font-semibold text-sm py-3.5 px-6 shrink-0">
                    <div>Assignment</div>
                    <div className="text-center">Score</div>
                    <div className="text-right">Date Graded</div>
                  </div>

                  {gradedEssays.length === 0 ? (
                    <div className="flex items-center justify-center h-28 bg-white text-slate-400 italic text-sm">
                      No recently graded essays.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 overflow-y-auto flex-1 min-h-0">
                      {gradedEssays.map((essay) => (
                        <div
                          key={essay.id}
                          onClick={() => setSelectedEssay(essay)}
                          className="grid grid-cols-3 items-center text-slate-700 font-medium text-base py-4 px-6 bg-white cursor-pointer hover:bg-slate-50/80 transition-colors duration-150"
                        >
                          <div className="text-slate-800">{essay.title}</div>
                          <div className="text-center text-emerald-500">
                            {essay.score}
                          </div>
                          <div className="text-right text-sm text-slate-500">
                            {essay.gradedDate}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-[54px] font-bold text-[#1e293b] tracking-tight leading-none">
                    Welcome back, {userName}!
                  </h1>
                  <p className="text-xs text-slate-600 ml-0.5">
                    Join a class to start viewing your assignments and feedback.
                  </p>
                </div>
                <button
                  onClick={openJoinModal}
                  className="bg-white text-slate-800 font-medium py-3 px-6 border border-[#cbd5e1] rounded-xl shadow-sm cursor-pointer text-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-95"
                >
                  Join Class
                </button>
              </div>

              {classes.length === 0 ? (
                <div className="w-full h-160 flex flex-col items-center justify-center bg-[#c5ecff] rounded-xl text-[#1e293b]">
                  <h2 className="text-4xl font-semibold tracking-wide">
                    No Classes
                  </h2>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Classes you have will display here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {classes.map((c) => (
                    <div
                      key={c.id}
                      className="w-full h-56 bg-white rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow flex flex-col relative overflow-visible"
                    >
                      <div
                        onClick={() => setSelectedClass(c)}
                        className="flex flex-col flex-grow"
                      >
                        <div className="bg-[#7ba4cc] p-4 h-28 rounded-t-xl flex items-start justify-between gap-3">
                          <div className="max-w-[calc(100%-4rem)]">
                            <h3 className="font-bold text-lg text-white truncate">
                              {c.class_name}
                            </h3>
                            <p className="text-sm text-white/90 mt-1 truncate">
                              {c.section || c.teacherName}
                            </p>
                          </div>
                          <div className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                            {c.teacherAvatarUrl ? (
                              <img
                                src={c.teacherAvatarUrl}
                                alt={c.teacherName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-3xl text-[#5b21b6]">
                                👤
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-grow p-4">
                          <p className="text-sm text-slate-500">
                            {c.teacherName
                              ? `Teacher: ${c.teacherName}`
                              : "Teacher"}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 p-2 flex justify-end relative">
                        <button
                          data-class-menu-btn
                          onClick={(event) => {
                            event.stopPropagation();
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
                          <div
                            data-class-menu
                            className="absolute bottom-14 right-3 z-30 w-32 bg-white border border-slate-200 rounded-xl shadow-xl"
                          >
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleUnenroll(c);
                              }}
                              className="w-full px-4 py-3 text-sm text-left text-red-600 hover:bg-slate-50"
                            >
                              Unenroll
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {showJoinModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
              <div className="w-full max-w-md bg-white rounded-[28px] shadow-2xl border border-slate-200 p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      Join Class
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Ask your teacher for the class code, then enter it here.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowJoinModal(false)}
                    className="text-slate-400 hover:text-slate-700 text-xl font-bold"
                  >
                    ✕
                  </button>
                </div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Class Code
                </label>
                <input
                  value={classCode}
                  onChange={(event) => setClassCode(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-[#7ba4cc] focus:ring-2 focus:ring-[#7ba4cc]/20"
                  placeholder="Class Code"
                />
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowJoinModal(false)}
                    className="bg-white text-slate-700 border border-slate-200 rounded-2xl px-5 py-2.5 font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinClass}
                    className="bg-[#7ba4cc] text-white rounded-2xl px-5 py-2.5 font-medium hover:bg-[#6996b3]"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
