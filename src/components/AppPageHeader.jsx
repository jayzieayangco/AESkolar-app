/**
 * Global app header: logo, subtitle, optional search, profile + logout.
 */
export default function AppPageHeader({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search here",
  showSearch = true,
}) {
  return (
    <div className="flex items-center justify-between pl-10 pb-4 pr-2 gap-4">
      <div className="flex items-center gap-1.5 min-w-0">
        <img
          src="/logo.png"
          alt="AESkolar Logo"
          className="h-14 w-auto object-contain shrink-0"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
        <div className="flex flex-col justify-center ml-2">
          <span className="text-brand-title">AESkolar</span>
          <span className="text-brand-subtitle">
            write better, learn smarter.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-1 justify-end max-w-2xl">
        {showSearch && (
          <div className="relative w-80 max-w-full hidden sm:block">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="w-full bg-white text-slate-700 pl-5 pr-11 py-2.5 rounded-full border-0 outline-none text-base placeholder-slate-400 shadow-sm"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
