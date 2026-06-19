import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSession,
  fetchDocuments,
  searchDocuments,
  uploadDocumentFromFile,
  moveDocumentToTrash,
  downloadDocumentContent,
} from "../../services/api.js";
import AppPageHeader from "../../components/AppPageHeader.jsx";
import SidebarNav from "../../components/SidebarNav.jsx";
import SidebarProfileRow from "../../components/SidebarProfileRow.jsx";
import { documentPreview } from "../../utils/essayValidation.js";

export default function Student_Documents() {
  const navigate = useNavigate();
  const [activeTab] = useState("Documents");
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Clean layout matching student views (Including Settings tab now)
  const sidebarItems = ["Dashboard", "Documents", "Trash", "Settings"];

  const handleNavigation = (item) => {
    if (item === "Dashboard") navigate("/student_dashboard");
    if (item === "Documents") navigate("/student_documents");
    if (item === "Trash") navigate("/student_trash");
    if (item === "Settings") navigate("/student_settings");
  };

  const handleCreateDocument = () => {
    navigate("/student_essay_editor");
  };

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    const { session } = await getSession();
    if (!session) {
      setErrorMessage("Please sign in again.");
      setIsLoading(false);
      navigate("/sign_in");
      return;
    }
    const filters = {
      userId: session.user.id,
      role: "student",
    };
    const { data, error } = searchQuery.trim()
      ? await searchDocuments({
          ...filters,
          query: searchQuery.trim(),
          excludeStatus: "trash",
        })
      : await fetchDocuments(filters);
    if (error) {
      setErrorMessage(error.message || "Failed to load documents.");
      setDocuments([]);
    } else {
      setDocuments(data || []);
    }
    setIsLoading(false);
  }, [navigate, searchQuery]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadDocuments();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadDocuments]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = null;
    if (!file) return;
    setIsLoading(true);
    setErrorMessage("");
    const { session } = await getSession();
    if (!session) {
      setErrorMessage("Upload failed. Please sign in again.");
      setIsLoading(false);
      return;
    }
    const { error } = await uploadDocumentFromFile(
      session.user.id,
      "student",
      file,
    );
    if (error) setErrorMessage(error.message || "Upload failed.");
    else await loadDocuments();
    setIsLoading(false);
  };

  const handleDownload = (file) => {
    downloadDocumentContent(file);
    setActiveMenuId(null);
  };

  const handleDelete = async (file) => {
    const { error } = await moveDocumentToTrash(file.id);
    if (error) alert(error.message || "Could not move to trash.");
    else await loadDocuments();
    setActiveMenuId(null);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#c5ecff] pt-6 pr-6 font-sans overflow-hidden box-border gap-0">
      <AppPageHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

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
        <div className="flex-1 h-full flex flex-col gap-8 overflow-y-auto box-border pr-2 pb-6">
          <div>
            <h1 className="text-page-title">Documents</h1>
          </div>

          {errorMessage && (
            <p className="text-red-600 text-sm -mt-4">{errorMessage}</p>
          )}

          <input
            type="file"
            hidden
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          {/* Operational Core Utility Action Row Grid with Hover Effects */}
          <div className="flex items-center gap-6">
            <button
              onClick={handleCreateDocument}
              className="bg-white text-slate-800 font-medium py-3 px-8 rounded-xl shadow-[0_4px_6px_rgba(0,0,0,0.04)] cursor-pointer text-base transition-all duration-150 hover:bg-slate-50 hover:shadow-md active:scale-[0.98]"
            >
              Create Document
            </button>
            <button
              onClick={handleUploadClick}
              className="bg-white text-slate-800 font-medium py-3 px-8 rounded-xl shadow-[0_4px_6px_rgba(0,0,0,0.04)] cursor-pointer text-base transition-all duration-150 hover:bg-slate-50 hover:shadow-md active:scale-[0.98]"
            >
              Upload File
            </button>
          </div>

          {/* CONDITIONAL CONTENT VIEWPORT DISPLAY */}
          {isLoading ? (
            <p className="text-slate-600 text-sm">Loading documents...</p>
          ) : documents.length === 0 ? (
            /* EMPTY VIEW PORT */
            <div className="flex-1 flex flex-col items-center justify-center pr-24 pb-20 select-none animate-fadeIn">
              <h2 className="text-[44px] font-medium text-[#000000] tracking-tight mb-1 text-center">
                Nothing here yet
              </h2>
              <p className="text-[11px] font-bold text-[#000000]/70 tracking-wide text-center leading-normal">
                Your docs will appear here once you start one.
                <br />
                Start writing a new doc.
              </p>
            </div>
          ) : (
            /* STANDARD POPULATED GRID CARD VIEW PORT */
            <div className="flex flex-col gap-4 mt-2 animate-fadeIn">
              <h2 className="text-[32px] font-medium text-[#1e293b]/90 tracking-tight">
                Recent
              </h2>

              <div className="grid-documents">
                {documents.map((file) => (
                  <div
                    key={file.id}
                    className="card-document transition-all duration-200 hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between border-b border-[#cbd5e1]/50 px-4 py-3 bg-slate-50/50 rounded-t-xl">
                      <span className="text-lg font-medium text-[#334155] truncate max-w-[130px]">
                        {file.title}
                      </span>

                      <div
                        className="relative"
                        ref={activeMenuId === file.id ? dropdownRef : null}
                      >
                        <button
                          onClick={() =>
                            setActiveMenuId(
                              activeMenuId === file.id ? null : file.id,
                            )
                          }
                          className="flex items-center gap-1 bg-[#7ba4cc]/20 hover:bg-[#7ba4cc]/40 px-2 py-1.5 rounded-md border border-[#7ba4cc]/30 transition-all cursor-pointer"
                        >
                          <span className="w-2.5 h-2.5 bg-[#7ba4cc] rounded-full inline-block"></span>
                          <span className="w-2.5 h-2.5 bg-[#cbd5e1] rounded-full inline-block"></span>
                        </button>

                        {activeMenuId === file.id && (
                          <div className="absolute left-full top-0 ml-1 z-30 w-32 bg-[#7ba4cc] border border-[#6993bc] rounded-lg shadow-lg overflow-hidden flex flex-col transform origin-top-left transition-all duration-100">
                            <button
                              onClick={() => {
                                navigate("/student_essay_editor", {
                                  state: {
                                    documentId: file.id,
                                    title: file.title,
                                    content: file.content,
                                  },
                                });
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-[#1e293b] font-medium hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              Open
                            </button>
                            <button
                              onClick={() => handleDownload(file)}
                              className="w-full text-left px-4 py-2 text-sm text-[#1e293b] font-medium hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              Download
                            </button>
                            <button
                              onClick={() => handleDelete(file)}
                              className="w-full text-left px-4 py-2 text-sm text-[#1e293b] font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 bg-white rounded-b-xl p-4 text-sm text-slate-600 leading-snug overflow-hidden">
                      {documentPreview(file.content, 100)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
