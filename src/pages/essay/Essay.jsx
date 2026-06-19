import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession } from "../../services/api.js";
import { useDebouncedDocumentSave } from "../../hooks/useDebouncedDocumentSave.js";
import DocumentEditor from "../../components/DocumentEditor.jsx";
import { gradeEssayWithAI } from "@ai-engine/gradingEngine.js";

export default function Essay() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [essayText, setEssayText] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  function navigateTo(route) {
    navigate(route);
  }

  // Intercept the logo click action to confirm navigation if unsaved content exists
  const handleBackNavigation = () => {
    // If there is text in the title or the essay block, prompt the user
    if (title.trim() !== "" || essayText.trim() !== "") {
      const confirmBack = window.confirm("Changes may not be saved, confirm going back?");
      if (!confirmBack) {
        return; // Terminate tracking sequence if user opts out
      }
    }
    // Proceed safely to previous page
    navigate(-1);
  };

  // Intercept save action and redirect unauthenticated users to the sign-in screen
  const handleSaveDraft = async () => {
    if (!title.trim() && !essayText.trim()) {
      alert("Please add a title or content before saving your draft.");
      return;
    }

    setSaveStatus("Saving...");
    const { session } = await getSession();

    const id = await saveNow(); // saves locally if signed out, Supabase if signed in

    if (!session) {
      setSaveStatus("Saved locally");
      setTimeout(() => setSaveStatus(""), 1800);
      alert("Saved locally. Sign in to sync your draft.");
      navigate("/sign_in");
      return;
    }

    setSaveStatus("Success!");
    setTimeout(() => navigate("/student_documents"), 600);
  };

  const { saveNow } = useDebouncedDocumentSave(
    { title, content: essayText, documentId: null, role: "student", assignmentTaskId: null },
    {
      enabled: true,
      debounceMs: 2000,
      onStatus: (status, msg) => {
        if (status === "saving") setSaveStatus("Saving...");
        if (status === "saved") {
          setSaveStatus("Success!");
          setTimeout(() => setSaveStatus(""), 2000);
        }
        if (status === "error") setSaveStatus(msg || "Failed to save draft.");
      },
    }
  );

  return (
    <div className="flex h-screen w-screen bg-[#c5ecff] p-6 gap-6 font-sans overflow-hidden box-border">
      
      {/* LEFT SIDE: Input Workspace */}
      <div className="flex flex-col flex-1 h-full gap-4">
        
        {/* Header / Logo Area with Dynamic Back Button Capabilities */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackNavigation}
            title="Go Back"
            className="bg-transparent border-none p-0 m-0 cursor-pointer transition-all duration-200 hover:opacity-80 flex items-center focus:outline-none"
          >
            <img 
              src="/logo.png" 
              alt="AESkolar Logo - Go Back" 
              className="h-16 w-auto object-contain"
              onError={(e) => {
                // Fallback placeholder display if image path is not yet configured
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
          </button>

          <div className="flex flex-col">
            <span className="text-[44px] font-bold text-[#1e293b] tracking-tight leading-none">
              AESkolar
            </span>
            <span className="text-xs text-[#475569] mt-0.2 ml-1">
              write better, learn smarter.
            </span>
          </div>
          {saveStatus && (
            <span
              className={`text-sm font-medium ${
                saveStatus.toLowerCase().includes("fail") ? "text-red-600" : "text-emerald-600"
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
            placeholder="Start typing your essay here..."
          />
        </div>

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-between pb-2">
          <button
            onClick={handleSaveDraft}
            className="bg-white text-slate-800 font-medium py-2.5 px-6 border border-[#cbd5e1] rounded-md shadow-sm cursor-pointer text-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            Save Draft
          </button>
          
          <div className="text-xs font-medium text-[#475569]">
            Word Count: {essayText.trim() === "" ? 0 : essayText.trim().split(/\s+/).length}
          </div>
        </div>
      </div>

    </div>
  );
}