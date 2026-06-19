import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSession } from "../../services/api.js";
import { useDebouncedDocumentSave } from "../../hooks/useDebouncedDocumentSave.js";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges.js";
import DocumentEditor from "../../components/DocumentEditor.jsx";
import { gradeEssayWithAI } from "@ai-engine/gradingEngine.js";

export default function Teacher_essay_editor() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialTitle = location.state?.title ?? "";
  const initialContent = location.state?.content ?? "";

  const [title, setTitle] = useState(initialTitle);
  const [essayText, setEssayText] = useState(initialContent);
  const [documentId, setDocumentId] = useState(
    location.state?.documentId ?? null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const savedSnapshot = useRef({
    title: initialTitle,
    content: initialContent,
  });

  const isDirty =
    title !== savedSnapshot.current.title ||
    essayText !== savedSnapshot.current.content;

  const { confirmIfDirty } = useUnsavedChanges(isDirty);

  const { saveNow } = useDebouncedDocumentSave(
    { title, content: essayText, documentId, role: "teacher" },
    {
      debounceMs: 2000,
      onStatus: (status, msg) => {
        if (status === "saving") setSaveStatus("Saving...");
        if (status === "saved") {
          setSaveStatus("Success!");
          savedSnapshot.current = { title, content: essayText };
          setTimeout(() => setSaveStatus(""), 2000);
        }
        if (status === "error") setSaveStatus(msg || "Failed to save draft.");
      },
    },
  );

  useEffect(() => {
    getSession().then(({ session }) => {
      if (!session) {
        console.debug(
          "[Auth] No session in teacher editor (live scoring still enabled).",
        );
      }
    });
  }, []);

  const handleSaveDraft = async () => {
    if (!title.trim() && !essayText.trim()) {
      alert("Please add a title or content before saving your draft.");
      return;
    }
    try {
      setIsSaving(true);
      setSaveStatus("Saving...");
      const { session } = await getSession();
      if (!session) {
        alert("Please sign in to save your draft.");
        setSaveStatus("");
        return;
      }
      const id = await saveNow();
      if (id) setDocumentId(id);
      savedSnapshot.current = { title, content: essayText };
      setSaveStatus("Success!");
      setTimeout(() => navigate("/teacher_documents"), 600);
    } catch (error) {
      alert(error.message || "Failed to save draft.");
      setSaveStatus("Failed to save draft.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#c5ecff] p-6 gap-6 font-sans overflow-hidden box-border">
      <div className="flex flex-col flex-1 h-full gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!confirmIfDirty()) return;
              navigate(-1);
            }}
            title="Go Back"
            className="bg-transparent border-none p-0 m-0 cursor-pointer transition-all duration-200 hover:opacity-80 flex items-center focus:outline-none"
          >
            <img
              src="/logo.png"
              alt="AESkolar Logo - Go Back"
              className="h-16 w-auto object-contain"
            />
          </button>
          <div className="flex flex-col flex-1">
            <span className="text-[44px] font-bold text-[#1e293b] tracking-tight leading-none">
              AESkolar
            </span>
            <span className="text-xs text-[#475569] mt-0.2 ml-1">
              Teacher Workspace • write better, learn smarter.
            </span>
          </div>
          {saveStatus && (
            <span
              className={`text-sm font-medium ${
                saveStatus.toLowerCase().includes("fail")
                  ? "text-red-600"
                  : "text-emerald-600"
              }`}
            >
              {saveStatus}
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0">
          <DocumentEditor
            title={title}
            onTitleChange={setTitle}
            content={essayText}
            onContentChange={setEssayText}
            rubric={null}
            gradeEssayWithAI={gradeEssayWithAI}
            placeholder="Start typing or reviewing the essay draft here..."
          />
        </div>

        <div className="flex items-center justify-between pb-2">
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="bg-white text-slate-800 font-medium py-2.5 px-6 border border-[#cbd5e1] rounded-md shadow-sm cursor-pointer text-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
          <div className="text-xs font-medium text-[#475569]">
            Word Count:{" "}
            {essayText.trim() === "" ? 0 : essayText.trim().split(/\s+/).length}
          </div>
        </div>
      </div>
    </div>
  );
}
