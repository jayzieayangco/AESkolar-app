import { useEffect, useState } from "react";
import { getSession, getProfileAvatarUrl } from "../services/api.js";
import { subscribeAvatarUpdates, getCachedAvatarUrl } from "../utils/profileAvatarStore.js";

export default function SidebarProfileIcon({ className = "" }) {
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    let userId = null;

    async function load() {
      const { session } = await getSession();
      if (!session) return;
      userId = session.user.id;
      const cached = getCachedAvatarUrl(userId);
      if (cached) {
        setAvatarUrl(cached);
        return;
      }
      const { url } = await getProfileAvatarUrl(userId);
      setAvatarUrl(url);
    }

    load();

    const unsub = subscribeAvatarUpdates((id, url) => {
      if (id === userId) setAvatarUrl(url);
    });

    return unsub;
  }, []);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Profile"
        className={`w-12 h-12 rounded-full object-cover shadow-sm border border-slate-200 ${className}`}
      />
    );
  }

  return (
    <div
      className={`w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 ${className}`}
    >
      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    </div>
  );
}
