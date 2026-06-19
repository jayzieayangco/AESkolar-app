import SidebarProfileIcon from "./SidebarProfileIcon.jsx";
import { useNavigate } from "react-router-dom";
import { signOut } from "../services/api.js";

/** Sidebar footer: profile icon + logout (moved from header). */
export default function SidebarProfileRow() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    await signOut();
    navigate("/sign_in");
  };

  return (
    <div className="relative flex items-center justify-between pt-5 px-6 border-t border-white/10 mb-2">
      <div className="flex items-center gap-3">
        <SidebarProfileIcon />
      </div>

      <div className="absolute right-6 transform -translate-x-1/2">
        <button
          type="button"
          onClick={handleLogout}
          className="btn-logout-header"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
