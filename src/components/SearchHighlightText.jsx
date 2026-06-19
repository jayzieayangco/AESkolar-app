/**
 * Renders text with <mark> around case-insensitive search matches.
 */
export default function SearchHighlightText({ text, searchQuery, className = "" }) {
  const raw = String(text ?? "");
  const term = searchQuery?.trim();

  if (!term) {
    return <span className={className}>{raw}</span>;
  }

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = raw.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={`${i}-${part}`} className="bg-yellow-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={`${i}-${part}`}>{part}</span>
        )
      )}
    </span>
  );
}
