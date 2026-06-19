import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getSession,
  getDocumentById,
  submitEvaluation,
  updateDocument,
  listEvaluations,
  releaseScore,
  fetchTeacherSubmissions,
  getUserProfile,
  listClasses,
} from "../../services/api.js";
import { gradeEssayWithAI } from "@ai-engine/gradingEngine.js";
import AppPageHeader from "../../components/AppPageHeader.jsx";
import SidebarNav from "../../components/SidebarNav.jsx";
import SidebarProfileRow from "../../components/SidebarProfileRow.jsx";
import SearchHighlightText from "../../components/SearchHighlightText.jsx";
import { clampScore, MAX_ESSAY_SCORE } from "../../utils/essayValidation.js";
import { formatDocumentStatus } from "../../utils/statusDisplay.js";

export default function Teacher_Grade_Essay() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab] = useState("Grade Essays");
  const [searchQuery, setSearchQuery] = useState("");
  const [essays, setEssays] = useState([]);
  const [selected, setSelected] = useState(null);
  const [proposedScore, setProposedScore] = useState(null);
  const [proposedFeedback, setProposedFeedback] = useState("");
  const [overrideScore, setOverrideScore] = useState("");
  const [overrideFeedback, setOverrideFeedback] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [lastEvaluationId, setLastEvaluationId] = useState(null);
  const [gradeMessage, setGradeMessage] = useState("");
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);

  const sidebarItems = [
    "Dashboard",
    "Documents",
    "Grade Essays",
    "Trash",
    "Settings",
  ];

  const handleNavigation = (item) => {
    if (item === "Dashboard") navigate("/teacher_dashboard");
    if (item === "Documents") navigate("/teacher_documents");
    if (item === "Grade Essays") navigate("/teacher_grade_essay");
    if (item === "Trash") navigate("/teacher_trash");
    if (item === "Settings") navigate("/teacher_settings");
  };

  const loadEssays = useCallback(
    async (classId = null) => {
      const { session } = await getSession();
      if (!session) {
        navigate("/sign_in");
        return;
      }
      const { data, error } = await fetchTeacherSubmissions(session.user.id, {
        ...(classId && { classId }),
      });
      if (error) {
        console.error(error);
        setEssays([]);
        return;
      }

      const filteredData = (data ?? []).filter(
        (essay) => essay.status !== "graded",
      );

      // Fetch student names for each essay
      const essaysWithStudentNames = await Promise.all(
        filteredData.map(async (essay) => {
          if (essay.user_id) {
            const { data: userData, error: userError } = await getUserProfile(
              essay.user_id,
            );
            if (userError) {
              console.error("Error fetching user profile:", userError);
            }
            return {
              ...essay,
              studentName:
                userData?.full_name ||
                userData?.email?.split("@")[0] ||
                "Unknown Student",
            };
          }
          return {
            ...essay,
            studentName: "Unknown Student",
          };
        }),
      );

      setEssays(essaysWithStudentNames);

      if (location.state?.essayId) {
        const { data: doc } = await getDocumentById(location.state.essayId);
        if (doc) {
          // Add student name to the selected doc if it has user_id
          if (doc.user_id) {
            const { data: userData, error: userError } = await getUserProfile(
              doc.user_id,
            );
            if (userError) {
              console.error(
                "Error fetching user profile for selected doc:",
                userError,
              );
            }
            doc.studentName =
              userData?.full_name ||
              userData?.email?.split("@")[0] ||
              "Unknown Student";
          } else {
            doc.studentName = "Unknown Student";
          }
          await handleSelectEssay(doc);
        }
      }
    },
    [navigate],
  );

  const loadTeacherClasses = useCallback(async () => {
    const { session } = await getSession();
    if (!session) {
      navigate("/sign_in");
      return;
    }
    const { data } = await listClasses({ teacherId: session.user.id });
    setClasses(data ?? []);
  }, [navigate]);

  useEffect(() => {
    loadTeacherClasses();
    loadEssays();
  }, [loadTeacherClasses, loadEssays]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadEssays(selectedClass);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [selectedClass, loadEssays]);

  const handleClassChange = (e) => {
    const classId = e.target.value;
    setSelectedClass(classId === "all" ? null : classId);
    loadEssays(classId === "all" ? null : classId);
  };

  const runAiProposal = async (essay) => {
    if (!essay?.content?.trim()) return;
    setIsAiLoading(true);
    try {
      const result = await gradeEssayWithAI({
        content: essay.content,
        rubric: null,
      });
      const score = clampScore(result?.totalScore ?? 0);
      setProposedScore(score);
      setOverrideScore(String(score));
      const tips = [
        ...(result?.suggestions ?? []),
        ...(result?.strengths?.length
          ? [`Strengths: ${result.strengths.slice(0, 2).join(" ")}`]
          : []),
      ];
      const text = tips.length
        ? tips.join("\n")
        : "Review Content, Organization, Language, and Mechanics before finalizing.";
      setProposedFeedback(text);
      setOverrideFeedback(text);
    } catch (e) {
      console.warn(e);
      setProposedFeedback(
        "AI proposal unavailable. Enter a manual score and feedback.",
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSelectEssay = async (essay) => {
    setSelected(essay);
    setProposedScore(null);
    setProposedFeedback("");
    setOverrideScore("");
    setOverrideFeedback("");
    setGradeMessage("");
    const { data: evals } = await listEvaluations({ essayId: essay.id });
    setLastEvaluationId(evals?.[0]?.id ?? null);
    await runAiProposal(essay);
  };

  const handleGrade = async () => {
    console.log("handleGrade called");
    if (!selected || overrideScore === "") {
      alert("Select an essay and enter a final override score (0–10).");
      return;
    }
    try {
      setIsGrading(true);
      const finalScore = clampScore(overrideScore);
      console.log("Calling submitEvaluation...");
      const { data: result, error } = await submitEvaluation({
        essayId: selected.id,
        totalScore: finalScore,
        suggestions: overrideFeedback,
        strengths: overrideFeedback,
        feedbackSuggestions: overrideFeedback,
        status: "scored",
      });
      console.log("submitEvaluation returned:", { data: result, error });
      if (error) throw error;
      const evaluationId = result?.evaluation?.id;
      console.log("Got evaluationId:", evaluationId);
      if (evaluationId) {
        setLastEvaluationId(evaluationId);
        setGradeMessage(
          "Final grade saved. Click Release Score to show the student.",
        );
        console.log("Calling loadEssays...");
        loadEssays();
      }
    } catch (err) {
      console.error("Error in handleGrade:", err);
      alert(err.message || "Grading failed.");
    } finally {
      setIsGrading(false);
    }
  };

  const handleRelease = async () => {
    console.log("handleRelease called");
    console.log("lastEvaluationId:", lastEvaluationId);
    if (!lastEvaluationId) {
      alert("Save a grade first before releasing.");
      return;
    }
    try {
      setIsReleasing(true);
      console.log("Calling releaseScore...");
      const { data, error } = await releaseScore(lastEvaluationId);
      console.log("releaseScore returned:", { data, error });
      if (error) throw error;
      console.log("Successfully released!");
      setGradeMessage("Score released! Student can now see their grade.");
      console.log("Calling loadEssays...");
      loadEssays();
    } catch (err) {
      console.error("Error releasing score:", err);
      alert(err.message || "Release failed.");
    } finally {
      setIsReleasing(false);
    }
  };

  const handleExport = () => {
    if (!essays.length) return;
    const csv = [
      ["Title", "Status", "Created"].join(","),
      ...essays.map((e) =>
        [e.title, formatDocumentStatus(e.status), e.created_at].join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "essays-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEssays = essays.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(e.title ?? "")
        .toLowerCase()
        .includes(q) ||
      String(e.content ?? "")
        .toLowerCase()
        .includes(q)
    );
  });

  return (
    <div className="flex flex-col h-screen w-screen bg-[#c5ecff] pt-6 pr-6 font-sans overflow-hidden box-border">
      <AppPageHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search essays"
      />

      <div className="flex flex-1 w-full gap-8 overflow-hidden min-h-0">
        <div className="w-[400px] bg-[#7ba4cc] h-full flex flex-col justify-between py-8 pl-4 rounded-tr-2xl shadow-[5px_0_15px_rgba(0,0,0,0.05)]">
          <SidebarNav
            items={sidebarItems}
            activeTab={activeTab}
            onNavigate={handleNavigation}
          />
          <SidebarProfileRow />
        </div>

        <div className="flex-1 h-full flex flex-col gap-4 overflow-hidden pr-2 pb-6">
          <div className="flex items-start justify-between">
            <h1 className="text-page-title">Grade Essays</h1>
            {selected && (
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setOverrideScore("");
                  setOverrideFeedback("");
                  setGradeMessage("");
                }}
                className="text-slate-700 hover:text-slate-900 font-bold text-2xl mt-2 cursor-pointer"
                aria-label="Close submission"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <label
                htmlFor="class-filter"
                className="text-sm font-semibold text-slate-700"
              >
                Filter by Class:
              </label>
              <select
                id="class-filter"
                value={selectedClass || "all"}
                onChange={handleClassChange}
                className="bg-white text-slate-800 font-medium py-2.5 px-4 border border-[#cbd5e1] rounded-xl shadow-sm text-sm transition-all duration-200 hover:border-[#7ba4cc] cursor-pointer"
              >
                <option value="all">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={!essays.length}
              className="bg-white text-slate-800 font-medium py-2.5 px-6 rounded-xl shadow-sm text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-200"
            >
              Export
            </button>
          </div>

          <div className="flex-1 bg-white border border-[#cbd5e1]/40 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto min-h-0">
              <div className="border border-slate-100 rounded-lg p-4 overflow-y-auto">
                <h3 className="text-sm font-semibold text-slate-600 mb-3">
                  Submissions
                </h3>
                {filteredEssays.length === 0 ? (
                  <p className="text-slate-400 italic text-sm">
                    No essays to grade.
                  </p>
                ) : (
                  filteredEssays.map((essay) => (
                    <button
                      key={essay.id}
                      type="button"
                      onClick={() => handleSelectEssay(essay)}
                      className={`block w-full text-left p-3 mb-2 rounded-lg border text-sm ${
                        selected?.id === essay.id
                          ? "border-slate-400 bg-slate-50"
                          : "border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <div className="font-medium">{essay.title}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {essay.studentName || "Unknown Student"}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        <span
                          className={`py-1 text-xs font-semibold ${
                            essay.status === "submitted"
                              ? " text-yellow-700"
                              : essay.status === "scored"
                                ? "text-blue-700"
                                : "bg-slate-100 text-slate-800 border border-slate-200"
                          }`}
                        >
                          {formatDocumentStatus(essay.status)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="border border-slate-100 rounded-lg p-4 flex flex-col">
                {selected ? (
                  <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">
                        {selected.title}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(null);
                          setOverrideScore("");
                          setOverrideFeedback("");
                          setGradeMessage("");
                        }}
                        className="text-slate-600 hover:text-slate-900 font-bold text-lg shrink-0"
                        aria-label="Close"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="overflow-y-auto text-sm text-slate-700 whitespace-pre-wrap border border-slate-100 rounded p-3 mb-3 max-h-[140px] shrink-0">
                      <SearchHighlightText
                        text={selected.content || "No content."}
                        searchQuery={searchQuery}
                      />
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 text-sm shrink-0">
                      <p className="font-semibold text-slate-600 mb-1">
                        Score (proposed) {isAiLoading ? "…" : ""}
                      </p>
                      <p className="text-2xl font-bold text-slate-800">
                        {proposedScore != null
                          ? `${proposedScore} / ${MAX_ESSAY_SCORE}`
                          : "—"}
                      </p>
                    </div>

                    <div className="flex-1 min-h-[200px] max-h-[280px] overflow-y-auto border border-slate-100 rounded-lg p-3 mb-3 bg-white">
                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                        Suggestions
                      </p>
                      <p className="text-slate-600 whitespace-pre-wrap text-sm leading-relaxed">
                        {proposedFeedback || "Loading suggestions…"}
                      </p>
                    </div>

                    <label className="text-sm font-semibold text-slate-700">
                      Teacher Override (final, max {MAX_ESSAY_SCORE})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={MAX_ESSAY_SCORE}
                      step={0.5}
                      placeholder="Final score"
                      value={overrideScore}
                      onChange={(e) =>
                        setOverrideScore(
                          String(
                            clampScore(
                              e.target.value === "" ? 0 : e.target.value,
                            ),
                          ),
                        )
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 mb-2 text-sm"
                    />
                    <textarea
                      placeholder="Final feedback (Content, Organization, Language, Mechanics)"
                      value={overrideFeedback}
                      onChange={(e) => setOverrideFeedback(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 mb-3 h-24 resize-none text-sm"
                    />
                    {gradeMessage && (
                      <p className="text-sm text-emerald-700 mb-2">
                        {gradeMessage}
                      </p>
                    )}
                    <div className="flex gap-2 justify-end flex-wrap">
                      <button
                        type="button"
                        onClick={handleGrade}
                        disabled={isGrading}
                        className="bg-slate-800 text-white py-2 px-4 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {isGrading ? "Saving…" : "Finalize Grade"}
                      </button>
                      <button
                        type="button"
                        onClick={handleRelease}
                        disabled={isReleasing || !lastEvaluationId}
                        className="bg-white text-slate-800 border border-slate-300 py-2 px-4 rounded-lg text-sm disabled:opacity-50"
                      >
                        {isReleasing ? "Releasing…" : "Release Score"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 italic text-sm m-auto">
                    Select an essay to grade.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
