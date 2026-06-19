import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "../hooks/useDebounce.js";
import { MAX_ESSAY_SCORE } from "../utils/essayValidation.js";
import {
  GIBBERISH_MESSAGE,
  ESSAY_TOO_SHORT_MESSAGE,
  isGibberishText,
} from "@ai-engine/rubricScoring.js";

/**
 * DocumentEditor (reusable)
 * - Debounced live grading (2s)
 * - Self-healing: AI errors become UI message, never crash
 * - Logs every pipeline stage for easy debugging
 */
export default function DocumentEditor({
  title,
  onTitleChange,
  content,
  onContentChange,
  rubric = null,
  gradeEssayWithAI,
  placeholder = "Start typing your essay here...",
  searchQuery = "",
  minSentences = 2,
  onValidityChange,
  showSubmitControls = false,
  onSubmit,
  submitLabel = "Submit",
}) {
  const debouncedContent = useDebounce(content ?? "", 2000);

  const [isGrading, setIsGrading] = useState(false);
  const [liveGrade, setLiveGrade] = useState(null);
  const [aiMessage, setAiMessage] = useState("");

  const hasText = useMemo(() => Boolean((content ?? "").trim()), [content]);
  const tooShort = useMemo(() => {
    const t = String(content ?? "").trim();
    if (!t) return false;
    const sentences = t.split(/[.!?]+/).filter((s) => s.trim()).length;
    return sentences < minSentences;
  }, [content, minSentences]);

  const isGibberish = useMemo(() => isGibberishText(content ?? ""), [content]);

  useEffect(() => {
    onValidityChange?.({
      tooShort,
      isGibberish,
      canSubmit: hasText && !tooShort && !isGibberish,
    });
  }, [tooShort, isGibberish, hasText, onValidityChange]);

  useEffect(() => {
    // Avoid grading empty docs
    const text = String(debouncedContent ?? "").trim();
    if (!text) {
      console.debug("[AI] debounce fired: empty content → clear grade");
      setIsGrading(false);
      setLiveGrade(null);
      setAiMessage("");
      return;
    }

    if (isGibberishText(text)) {
      setIsGrading(false);
      setLiveGrade(null);
      setAiMessage(GIBBERISH_MESSAGE);
      return;
    }

    const sentenceParts = text.split(/[.!?]+/).filter((s) => s.trim());
    if (sentenceParts.length < minSentences) {
      setIsGrading(false);
      setLiveGrade(null);
      setAiMessage(ESSAY_TOO_SHORT_MESSAGE);
      return;
    }

    let cancelled = false;

    async function run() {
      console.debug("[AI] debounce fired → begin grading", {
        chars: text.length,
      });
      setIsGrading(true);
      setAiMessage("");

      try {
        console.debug("[AI] calling gradeEssayWithAI(...)");
        const result = await gradeEssayWithAI({
          content: text,
          rubric,
        });
        if (!cancelled && result?.errorMessage) {
          setLiveGrade(null);
          setAiMessage(result.errorMessage);
          return;
        }
        console.debug("[AI] gradeEssayWithAI success", {
          totalScore: result?.totalScore,
          maxScore: result?.maxScore,
        });
        if (!cancelled) {
          const capped = {
            ...result,
            totalScore: Math.min(MAX_ESSAY_SCORE, Number(result?.totalScore ?? 0)),
            maxScore: Math.min(MAX_ESSAY_SCORE, Number(result?.maxScore ?? 10)),
          };
          setLiveGrade(capped);
        }
      } catch (err) {
        console.error("[AI] gradeEssayWithAI failed", err);
        if (!cancelled) {
          setLiveGrade(null);
          setAiMessage("AI currently unavailable. Please try again in a moment.");
        }
      } finally {
        if (!cancelled) setIsGrading(false);
        console.debug("[AI] grading pipeline end");
      }
    }

    run();

    return () => {
      cancelled = true;
      console.debug("[AI] grading cancelled (content changed / unmounted)");
    };
  }, [debouncedContent, rubric, gradeEssayWithAI]);

  return (
    <div className="flex h-full w-full gap-6">
      <div className="flex flex-col flex-1 h-full gap-4">
        <input
          type="text"
          placeholder="Input Title Here"
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          className="w-full bg-[#dcf2fe] border border-[#a6d5fa] rounded-lg py-3 px-4 text-center text-lg font-medium text-[#334155] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#7dd3fc]"
        />

        <textarea
          placeholder={placeholder}
          value={content}
          onChange={(e) => onContentChange?.(e.target.value)}
          className="w-full flex-1 bg-white border border-[#a6d5fa] rounded-lg p-6 text-base text-[#334155] placeholder-[#94a3b8] resize-none focus:outline-none focus:ring-2 focus:ring-[#7dd3fc] overflow-y-auto leading-relaxed shadow-sm"
          data-search-term={searchQuery?.trim() || undefined}
        />
        {(tooShort || isGibberish) && hasText && (
          <p className="text-sm text-amber-700 font-medium" role="alert">
            {isGibberish ? GIBBERISH_MESSAGE : ESSAY_TOO_SHORT_MESSAGE}
          </p>
        )}
      </div>

      <div className="w-[340px] md:w-[380px] h-full flex flex-col gap-4">
        <div className="h-[270px] bg-white border border-[#cbd5e1] rounded-lg p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[#1e293b]">Score</h2>
            {isGrading && <span className="text-xs font-medium text-slate-500">Grading…</span>}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-lg bg-slate-50/50 overflow-hidden">
            {aiMessage ? (
              <span className="text-sm text-red-600 text-center px-4">{aiMessage}</span>
            ) : liveGrade ? (
              <div className="w-full px-4 py-3">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-4xl font-bold text-slate-800">
                    {liveGrade.totalScore}
                  </span>
                  <span className="text-sm font-medium text-slate-500">/ {liveGrade.maxScore}</span>
                </div>

                <div className="mt-4 space-y-2">
                  {(liveGrade.rubricScores ?? []).map((row) => (
                    <div key={row.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{row.name}</span>
                      <span className="font-semibold text-slate-800">
                        {row.score} / {row.maxScore}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-sm text-[#64748b] text-center px-4">
                {hasText ? "Stop typing for 2 seconds to see live feedback." : "Start typing to see live feedback."}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-[280px] bg-white border border-[#cbd5e1] rounded-lg p-5 shadow-sm flex flex-col">
          <h2 className="text-xl font-semibold text-[#1e293b] mb-3">Suggestions</h2>
          <div className="flex-1 overflow-y-auto text-sm text-[#475569] leading-relaxed pr-1">
            {liveGrade?.suggestions?.length ? (
              <ul className="list-disc pl-5 space-y-2">
                {liveGrade.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[#94a3b8] italic">No suggestions available yet.</p>
            )}
          </div>
        </div>

        {showSubmitControls && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!hasText || tooShort || isGibberish}
            className="w-full bg-slate-800 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitLabel}
          </button>
        )}
      </div>
    </div>
  );
}

