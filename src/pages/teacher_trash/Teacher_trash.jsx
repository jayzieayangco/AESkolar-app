import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSession,
  fetchTrash,
  restoreDocument,
  deleteDocument,
} from "../../services/api.js";
import AppPageHeader from "../../components/AppPageHeader.jsx";
import SidebarNav from "../../components/SidebarNav.jsx";
import SidebarProfileRow from "../../components/SidebarProfileRow.jsx";
import { documentPreview } from "../../utils/essayValidation.js";

export default function Teacher_Trash() {
  const navigate = useNavigate();
  const [activeTab] = useState("Trash");
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);
  const [trashItems, setTrashItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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
    if (item === "Trash") navigate("/teacher_trash");
    if (item === "Grade Essays") navigate("/teacher_grade_essay");
    if (item === "Settings") navigate("/teacher_settings");
  };

  const loadTrash = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    const { session } = await getSession();
    if (!session) {
      navigate("/sign_in");
      return;
    }
    const { data, error } = await fetchTrash({
      userId: session.user.id,
      role: "teacher",
    });
    if (error) {
      setErrorMessage(error.message || "Failed to load trash.");
      setTrashItems([]);
    } else {
      setTrashItems(data ?? []);
    }
    setIsLoading(false);
  }, [navigate]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadTrash();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = trashItems.filter((file) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(file.title ?? "")
        .toLowerCase()
        .includes(q) ||
      String(file.content ?? "")
        .toLowerCase()
        .includes(q)
    );
  });

  return (
    <div className="flex flex-col h-screen w-screen bg-[#c5ecff] pt-6 pr-6 font-sans overflow-hidden box-border">
      <AppPageHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search trash"
      />

      <div className="flex flex-1 w-full gap-8 overflow-hidden">
        <div className="w-[400px] bg-[#7ba4cc] h-full flex flex-col justify-between py-8 pl-4 rounded-tr-2xl shadow-[5px_0_15px_rgba(0,0,0,0.05)]">
          <SidebarNav
            items={sidebarItems}
            activeTab={activeTab}
            onNavigate={handleNavigation}
          />
          <SidebarProfileRow />
        </div>

        <div className="flex-1 h-full flex flex-col gap-8 overflow-y-auto pr-2 pb-6">
          <div>
            <h1 className="text-page-title">Trash</h1>
          </div>

          {errorMessage && (
            <p className="text-red-600 text-sm font-medium">{errorMessage}</p>
          )}

          {isLoading ? (
            <p className="text-slate-600 text-sm">Loading trash...</p>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center pr-24 pb-20">
              <h2 className="text-[44px] font-medium text-[#000000] tracking-tight mb-1 text-center">
                Nothing here yet
              </h2>
              <p className="text-[11px] font-bold text-[#000000]/70 tracking-wide text-center leading-normal">
                Your docs will appear here once you delete one.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 mt-2">
              <h2 className="text-[32px] font-medium text-[#1e293b]/90 tracking-tight">
                Recent
              </h2>
              <div className="grid-documents">
                {filtered.map((file) => (
                  <div key={file.id} className="card-document">
                    <div className="flex items-center justify-between border-b border-[#cbd5e1]/50 px-4 py-3 bg-slate-50/50 rounded-t-xl">
                      <span className="text-lg font-medium text-[#334155] truncate max-w-[130px]">
                        {file.title}
                      </span>
                      <div
                        className="relative"
                        ref={activeMenuId === file.id ? dropdownRef : null}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuId(
                              activeMenuId === file.id ? null : file.id,
                            )
                          }
                          className="flex items-center gap-1 bg-[#7ba4cc]/20 hover:bg-[#7ba4cc]/40 px-2 py-1.5 rounded-md border border-[#7ba4cc]/30 cursor-pointer"
                        >
                          <span className="w-2.5 h-2.5 bg-[#7ba4cc] rounded-full inline-block" />
                          <span className="w-2.5 h-2.5 bg-[#cbd5e1] rounded-full inline-block" />
                        </button>
                        {activeMenuId === file.id && (
                          <div className="absolute left-full top-0 ml-1 z-30 w-32 bg-[#7ba4cc] border border-[#6993bc] rounded-lg shadow-lg flex flex-col">
                            <button
                              type="button"
                              onClick={async () => {
                                await restoreDocument(file.id);
                                loadTrash();
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm font-medium hover:bg-white/10 cursor-pointer"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (
                                  window.confirm(
                                    "Permanently delete this document?",
                                  )
                                ) {
                                  await deleteDocument(file.id);
                                  loadTrash();
                                }
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm font-medium hover:bg-red-500/20 cursor-pointer"
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
