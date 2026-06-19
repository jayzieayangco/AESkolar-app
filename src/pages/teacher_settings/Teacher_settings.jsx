import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSession,
  getUserProfile,
  updateUserProfile,
  signOut,
  uploadProfilePic,
} from "../../services/api.js";
import { setCachedAvatarUrl } from "../../utils/profileAvatarStore.js";
import AppPageHeader from "../../components/AppPageHeader.jsx";
import SidebarNav from "../../components/SidebarNav.jsx";
import SidebarProfileRow from "../../components/SidebarProfileRow.jsx";

export default function Teacher_Settings() {
  const navigate = useNavigate();
  const [activeTab] = useState("Settings");

  // Form State Configurations
  const [uploadingPic, setUploadingPic] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const profileInputRef = useRef(null);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Teacher navigation items
  const sidebarItems = ["Dashboard", "Documents", "Grade Essays", "Trash", "Settings"];

  const handleNavigation = (item) => {
    if (item === "Dashboard") navigate("/teacher_dashboard");
    if (item === "Documents") navigate("/teacher_documents");
    if (item === "Grade Essays") navigate("/teacher_grade_essay");
    if (item === "Trash") navigate("/teacher_trash");
    if (item === "Settings") navigate("/teacher_settings");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    (async () => {
      const { session } = await getSession();
      if (!session) {
        navigate("/sign_in");
        return;
      }
      const { data } = await getUserProfile(session.user.id);
      setProfile((p) => ({
        ...p,
        name: data?.full_name ?? "",
        email: session.user.email ?? "",
      }));
    })();
  }, [navigate]);

  const handleProfileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadMessage("Please choose an image file.");
      return;
    }
    try {
      setUploadingPic(true);
      setUploadMessage("Uploading...");
      const { session } = await getSession();
      if (!session) return;
      const { url, error } = await uploadProfilePic(session.user.id, file);
      if (error) throw error;
      if (url) setCachedAvatarUrl(session.user.id, url);
      setUploadMessage("Success! Profile picture updated.");
    } catch (err) {
      setUploadMessage(err.message || "Upload failed.");
    } finally {
      setUploadingPic(false);
    }
  };

  const handleSaveChanges = async () => {
    const { session } = await getSession();
    if (!session) return;
    const { error } = await updateUserProfile(session.user.id, { full_name: profile.name });
    if (error) alert(error.message || "Save failed.");
    else alert("Settings saved.");
  };

  const handleLogout = async () => {
    const confirmsLogout = window.confirm("Are you sure you want to log out?");
    if (confirmsLogout) {
      try {
        await signOut();
        sessionStorage.removeItem("auth_processed");
        navigate("/");
      } catch (error) {
        console.error("Error signing out:", error);
        // Fallback redirection in case network drop occurs
        navigate("/");
      }
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#c5ecff] pt-6 font-sans overflow-hidden box-border gap-0 relative">
      
      <AppPageHeader showSearch={false} />

      {/* MAIN CONTAINER LAYOUT */}
      <div className="flex flex-1 w-full gap-8 overflow-hidden items-stretch">
        
        {/* LEFT SIDEBAR PANEL */}
        <div className="w-[400px] bg-[#7ba4cc] flex flex-col justify-between py-8 pl-4 relative shadow-[5px_0_15px_rgba(0,0,0,0.05)] rounded-tr-2xl h-full box-border">
          <div className="flex flex-col w-full">
            <SidebarNav items={sidebarItems} activeTab={activeTab} onNavigate={handleNavigation} />
          </div>

          {/* User Profile Control */}
          <SidebarProfileRow />
        </div>

        {/* RIGHT SETTINGS WORKSPACE */}
        <div className="flex-1 h-full flex flex-col gap-6 overflow-y-auto box-border pr-8 pb-28 animate-fadeIn">
          
          <div>
            <h1 className="text-page-title">Settings</h1>
          </div>

          {/* SETTINGS SPLIT PANEL */}
          <div className="flex gap-12 w-full mt-2 items-start">
            
            {/* ACCOUNT MANAGEMENT COLUMN */}
            <div className="flex flex-col gap-5 flex-1 max-w-xl">
              <h2 className="text-xl font-bold text-slate-800 tracking-wide select-none">
                Account Management
              </h2> 

              <div className="flex items-start gap-6 w-full">
                {/* Profile Picture Uploader Box */}
                <div className="w-48 h-48 bg-transparent border border-slate-400/60 rounded-xl flex flex-col items-center justify-center gap-3 p-4 bg-slate-50/10">
                  <span className="text-slate-700 text-sm font-medium">Profile Picture</span>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    ref={profileInputRef}
                    onChange={handleProfileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => profileInputRef.current?.click()}
                    disabled={uploadingPic}
                    className="bg-white text-slate-800 font-medium py-1.5 px-6 rounded-lg shadow-sm border border-slate-200 text-xs transition-all duration-200 hover:bg-slate-50 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    {uploadingPic ? "Uploading..." : "Upload"}
                  </button>
                  {uploadMessage && (
                    <p className="text-xs text-slate-600 mt-2 text-center">{uploadMessage}</p>
                  )}
                </div>

                {/* Input Fields Frame */}
                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-700 text-sm font-medium">Name</label>
                    <input 
                      type="text"
                      name="name"
                      value={profile.name}
                      onChange={handleInputChange}
                      className="w-full bg-[#c5ecff] border border-slate-400/60 rounded-xl px-4 py-3 text-slate-800 outline-none focus:border-slate-500 transition-all text-sm shadow-inner"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-slate-700 text-sm font-medium">Email</label>
                    <input 
                      type="email"
                      name="email"
                      value={profile.email}
                      onChange={handleInputChange}
                      className="w-full bg-[#c5ecff] border border-slate-400/60 rounded-xl px-4 py-3 text-slate-800 outline-none focus:border-slate-500 transition-all text-sm shadow-inner"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* VERTICAL DIVIDER LINE */}
            <div className="w-[1px] h-52 bg-slate-400/40 self-end mb-1"></div>

            {/* CHANGE PASSWORD COLUMN */}
            <div className="flex flex-col gap-5 w-64">
              <h2 className="text-xl font-bold text-slate-800 tracking-wide select-none">
                Change Password
              </h2>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-700 text-sm font-medium">New Password</label>
                  <input 
                    type="password"
                    name="newPassword"
                    value={profile.newPassword}
                    onChange={handleInputChange}
                    className="w-full bg-[#c5ecff] border border-slate-400/60 rounded-xl px-4 py-3 text-slate-800 outline-none focus:border-slate-500 transition-all text-sm shadow-inner"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-700 text-sm font-medium">Confirm Password</label>
                  <input 
                    type="password"
                    name="confirmPassword"
                    value={profile.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full bg-[#c5ecff] border border-slate-400/60 rounded-xl px-4 py-3 text-slate-800 outline-none focus:border-slate-500 transition-all text-sm shadow-inner"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* LOWER PREFERENCES CAPTION AREA */}
          {/* <div className="mt-4 border-t border-slate-400/20 pt-4">
            <h2 className="text-xl font-bold text-slate-800 tracking-wide select-none">
              Preferences
            </h2>
          </div> */}

        </div>
      </div>

      {/* FIXED FOOTER CONTROLS ROW PANEL */}
      <div className="absolute bottom-6 right-8 flex items-center gap-4 bg-transparent z-10">
        <button 
          onClick={handleSaveChanges}
          className="bg-white text-slate-800 font-medium py-2 px-6 rounded-xl shadow-[0_4px_6px_rgba(0,0,0,0.04)] text-base border border-slate-200 transition-all duration-200 hover:bg-slate-50 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          Save Changes
        </button>
      </div>

    </div>
  );
}