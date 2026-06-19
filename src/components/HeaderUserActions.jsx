import { useNavigate } from "react-router-dom";
import { signOut } from "../services/api.js";
import SidebarProfileIcon from "./SidebarProfileIcon.jsx";

/** Top-right profile + logout (with confirm). */
export default function HeaderUserActions() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    await signOut();
    navigate("/sign_in");
  };

  return (
    <div className="flex items-center gap-4 shrink-0">
      <SidebarProfileIcon />
      <button type="button" onClick={handleLogout} className="btn-logout-header">
        Logout
      </button>
    </div>
  );
}
