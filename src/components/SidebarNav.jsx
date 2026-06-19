/**
 * Consistent sidebar navigation tabs (fixed font size/weight).
 */
export default function SidebarNav({ items, activeTab, onNavigate }) {
  return (
    <nav className="flex flex-col w-full gap-2.5 mt-20">
      {items.map((item) => {
        const isActive = activeTab === item;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onNavigate(item)}
            className={`w-full text-left py-4 px-10 rounded-l-full transition-all duration-150 cursor-pointer ${
              isActive
                ? "bg-[#c5ecff] text-[#1e293b] text-tab-active pl-12 shadow-[-4px_4px_6px_rgba(0,0,0,0.05)]"
                : "text-[#1e293b]/80 hover:text-[#1e293b] hover:bg-white/10 hover:pl-11 text-tab-standard"
            }`}
          >
            {item}
          </button>
        );
      })}
    </nav>
  );
}
