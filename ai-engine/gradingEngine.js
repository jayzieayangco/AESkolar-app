/**

 * Aeskolar Grading Engine — Hybrid Client Adapter

 *

 * Primary:  Flask ML backend (Word2Vec + LSTM + spaCy/Calamancy) at /api/score

 * Fallback: Local heuristic grader (offline / when ML server unavailable)

 *

 * Single entry point for all React editors: gradeEssayWithAI({ content, rubric })

 */

import {
  reconcileRubricScores,
  isGibberishText,
  GIBBERISH_MESSAGE,
  ESSAY_TOO_SHORT_MESSAGE,
  roundHalf,
} from "./rubricScoring.js";

const AI_ENGINE_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_AI_ENGINE_URL
    ? import.meta.env.VITE_AI_ENGINE_URL.replace(/\/$/, "")
    : "";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function wordCount(text) {
  if (!text) return 0;

  return String(text)
    .trim()

    .split(/\s+/)

    .filter(Boolean).length;
}

function sentenceCount(text) {
  if (!text) return 0;

  const parts = String(text)
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts.length;
}

function paragraphCount(text) {
  if (!text) return 0;

  return String(text)
    .split(/\n\s*\n/g)

    .map((p) => p.trim())

    .filter(Boolean).length;
}

function estimateReadability(text) {
  const wc = wordCount(text);

  const sc = Math.max(1, sentenceCount(text));

  const avgWordsPerSentence = wc / sc;

  const score = 1 - Math.abs(avgWordsPerSentence - 17) / 17;

  return clamp(score, 0, 1);
}

/** Lightweight client-side language hint (server re-detects authoritatively). */

export function detectLanguage(text) {
  const markers = [
    "ang",
    "ng",
    "mga",
    "sa",
    "ay",
    "na",
    "hindi",
    "mabuti",
    "mahalaga",

    "edukasyon",
    "mag-aaral",
    "guro",
    "paaralan",
  ];

  const tokens =
    String(text)
      .toLowerCase()
      .match(/[a-zà-ÿñ]+/g) ?? [];

  if (!tokens.length) return "english";

  const hits = tokens.filter((t) => markers.includes(t)).length;

  if (/ñ/i.test(text) || hits / tokens.length >= 0.08) return "filipino";

  return "english";
}

/** Check if text is in valid language (English or Filipino) */
export function isValidLanguage(text) {
  const lang = detectLanguage(text);
  return lang === "english" || lang === "filipino";
}

/** Check if essay is relevant to the prompt */
function checkContextRelevance(text, prompt) {
  if (!prompt || !text) return true;

  const textLower = text.toLowerCase();
  const promptLower = prompt.toLowerCase();
  const promptWords = promptLower
    .split(/\s+/)
    .filter((word) => word.length > 3);

  if (promptWords.length === 0) return true;

  const matches = promptWords.filter((word) => textLower.includes(word)).length;
  return matches >= Math.min(2, promptWords.length * 0.3);
}

function normalizeRubric(rubricData) {
  if (!rubricData) {
    return {
      criteria: [
        { id: "content", name: "Content", maxScore: 4 },

        { id: "organization", name: "Organization", maxScore: 3 },

        { id: "language", name: "Language", maxScore: 2 },

        { id: "mechanics", name: "Mechanics", maxScore: 1 },
      ],
    };
  }

  if (Array.isArray(rubricData)) return { criteria: rubricData };

  if (Array.isArray(rubricData.criteria)) return rubricData;

  if (Array.isArray(rubricData.rubric)) return { criteria: rubricData.rubric };

  return { criteria: [] };
}

function scoreCriterion(criterion, essayContent) {
  const maxScore = Number(criterion?.maxScore ?? criterion?.max ?? 4) || 4;

  const name = String(criterion?.name ?? criterion?.title ?? "Criterion");

  const text = String(essayContent ?? "");

  const wc = wordCount(text);

  const pc = paragraphCount(text);

  const sc = sentenceCount(text);

  const hasIntro = wc >= 60 && pc >= 2;

  const hasConclusion = wc >= 120 && pc >= 3;

  const hasStructure = pc >= 3;

  const readability = estimateReadability(text);

  const veryShort = wc < 80;

  const tooLongSentences = wc > 0 && wc / Math.max(1, sc) > 28;

  const tooManyAllCaps = (text.match(/\b[A-Z]{5,}\b/g) ?? []).length >= 3;

  const lotsOfRepeatedSpaces = (text.match(/ {3,}/g) ?? []).length >= 2;

  const key = String(criterion?.id ?? name).toLowerCase();

  let base = 0.5;

  if (
    key.includes("content") ||
    key.includes("ideas") ||
    key.includes("argument")
  ) {
    base =
      (wc >= 200
        ? 0.9
        : wc >= 120
          ? 0.75
          : wc >= 80
            ? 0.6
            : wc >= 40
              ? 0.45
              : 0.2) *
      (readability * 0.6 + 0.4);
  } else if (key.includes("organization") || key.includes("structure")) {
    base =
      (hasStructure ? 0.85 : pc === 2 ? 0.6 : pc === 1 ? 0.35 : 0.45) *
      (hasIntro ? 1 : 0.85) *
      (hasConclusion ? 1 : 0.9);
  } else if (
    key.includes("language") ||
    key.includes("style") ||
    key.includes("voice")
  ) {
    base = readability * (veryShort ? 0.7 : 1);
  } else if (
    key.includes("mechanics") ||
    key.includes("grammar") ||
    key.includes("conventions")
  ) {
    base = 0.8;

    if (tooLongSentences) base *= 0.8;

    if (tooManyAllCaps) base *= 0.8;

    if (lotsOfRepeatedSpaces) base *= 0.9;

    if (text.includes("..") || text.includes("??") || text.includes("!!"))
      base *= 0.9;
  }

  const score = clamp(base, 0, 1) * maxScore;

  const strengths = [];

  const weaknesses = [];

  const suggestions = [];

  if (key.includes("organization") || key.includes("structure")) {
    if (hasStructure) strengths.push("Clear multi-paragraph structure.");
    else
      weaknesses.push("Essay would benefit from clearer paragraph structure.");

    if (!hasIntro)
      suggestions.push(
        "Add a short introduction that previews your main point.",
      );

    if (!hasConclusion)
      suggestions.push(
        "Add a conclusion that summarizes your main point and takeaway.",
      );
  }

  if (
    key.includes("content") ||
    key.includes("ideas") ||
    key.includes("argument")
  ) {
    if (wc >= 120) strengths.push("Good level of detail for the topic.");
    else weaknesses.push("Add more supporting details and examples.");

    if (veryShort)
      suggestions.push(
        "Expand your ideas with at least 1–2 concrete examples.",
      );
  }

  if (
    key.includes("language") ||
    key.includes("style") ||
    key.includes("voice")
  ) {
    if (readability >= 0.75)
      strengths.push("Sentences are generally readable.");
    else
      suggestions.push(
        "Vary sentence length; aim for ~12–22 words per sentence.",
      );
  }

  if (
    key.includes("mechanics") ||
    key.includes("grammar") ||
    key.includes("conventions")
  ) {
    if (tooManyAllCaps)
      suggestions.push("Avoid all-caps words; use emphasis sparingly.");

    if (lotsOfRepeatedSpaces)
      suggestions.push("Fix spacing issues (remove extra spaces).");

    if (tooLongSentences)
      suggestions.push("Split very long sentences to improve clarity.");
  }

  return {
    id: String(criterion?.id ?? name),
    name,
    score,
    maxScore,
    strengths,
    weaknesses,
    suggestions,
  };
}

/** Heuristic fallback grader (runs fully in-browser). */

export function gradeEssay(essayContent, rubricData, prompt = "") {
  const rubric = normalizeRubric(rubricData);
  const criteria = rubric.criteria ?? [];
  const rawRows = (
    criteria.length ? criteria : normalizeRubric(null).criteria
  ).map((c) => scoreCriterion(c, essayContent));

  let { rubricScores, totalScore, maxScore } = reconcileRubricScores(rawRows);

  // Check context relevance and adjust score
  const isRelevant = checkContextRelevance(essayContent, prompt);
  if (!isRelevant) {
    totalScore = Math.max(0, Math.min(4, totalScore)); // Cap score at 4/10 if not relevant
  }

  const strengths = [];
  const weaknesses = [];
  const suggestions = [];

  for (const row of rawRows) {
    strengths.push(...(row.strengths ?? []));
    weaknesses.push(...(row.weaknesses ?? []));
    suggestions.push(...(row.suggestions ?? []));
  }

  if (!isRelevant && prompt) {
    weaknesses.push("Your essay doesn't seem to be about the assigned topic.");
    suggestions.push(
      "Try to focus your writing on the specific topic or question you were assigned.",
    );
  }

  const uniq = (arr) => Array.from(new Set(arr)).slice(0, 6);

  let finalSuggestions = enrichConstructiveSuggestions(
    uniq(suggestions),
    rubricScores,
  );

  // Ensure there's always at least one suggestion
  if (finalSuggestions.length === 0) {
    finalSuggestions = [
      "Great job! Keep practicing your writing skills to improve even more.",
    ];
  }

  return {
    totalScore,
    maxScore,
    rubricScores,
    strengths: uniq(strengths),
    weaknesses: uniq(weaknesses),
    suggestions: finalSuggestions,
    metadata: { engine: "heuristic-fallback" },
  };
}

/** Adds rubric-focused constructive tips (Content, Organization, Language, Mechanics). */
function enrichConstructiveSuggestions(suggestions, rubricScores) {
  const tips = [...suggestions];
  const byId = Object.fromEntries(
    (rubricScores ?? []).map((r) => [String(r.id ?? r.name).toLowerCase(), r]),
  );
  if (
    byId.content &&
    Number(byId.content.score) < Number(byId.content.maxScore) * 0.75
  ) {
    tips.push(
      "Content: Strengthen your main argument with specific examples tied to the prompt.",
    );
  }
  if (
    byId.organization &&
    Number(byId.organization.score) < Number(byId.organization.maxScore) * 0.75
  ) {
    tips.push(
      "Organization: Use clear introduction, body, and conclusion paragraphs for flow.",
    );
  }
  if (
    byId.language &&
    Number(byId.language.score) < Number(byId.language.maxScore) * 0.75
  ) {
    tips.push(
      "Language: Vary sentence length and word choice to improve clarity and academic tone.",
    );
  }
  if (
    byId.mechanics &&
    Number(byId.mechanics.score) < Number(byId.mechanics.maxScore) * 0.75
  ) {
    tips.push(
      "Mechanics: Proofread punctuation, spacing, and capitalization before submitting.",
    );
  }
  return Array.from(new Set(tips)).slice(0, 8);
}

function normalizePayload(input, rubricData) {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return {
      content: String(input.content ?? ""),

      rubric: input.rubric ?? null,

      language: input.language ?? detectLanguage(input.content ?? ""),

      prompt:
        input.prompt ?? input.rubric?.prompt ?? input.rubric?.instruction ?? "",
    };
  }

  return {
    content: String(input ?? ""),

    rubric: rubricData ?? null,

    language: detectLanguage(input ?? ""),

    prompt: rubricData?.prompt ?? rubricData?.instruction ?? "",
  };
}

function normalizeMlResponse(data) {
  const baseSuggestions = data.suggestions ?? [];
  const reconciled = reconcileRubricScores(data.rubricScores ?? []);
  // Always use the reconciled total score from individual rubric scores, not the ML backend's total
  const mlTotal = roundHalf(Math.min(10, reconciled.totalScore));

  return {
    totalScore: mlTotal,
    maxScore: 10,
    rubricScores: reconciled.rubricScores,
    strengths: data.strengths ?? [],
    weaknesses: data.weaknesses ?? [],
    suggestions: enrichConstructiveSuggestions(
      baseSuggestions,
      reconciled.rubricScores,
    ),

    metadata: data.metadata ?? {
      language: data.language,

      engine: data.engine,

      prompt_relevance_similarity: data.prompt_relevance_similarity,
    },
  };
}

async function callMlEngine({ content, rubric, language, prompt }) {
  const url = `${AI_ENGINE_BASE || ""}/api/score`;

  console.debug("[AI] POST", url, { language, chars: content.length });

  const res = await fetch(url, {
    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({ content, rubric, language, prompt }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error || data.details || `ML engine HTTP ${res.status}`,
    );
  }

  if (data.error) throw new Error(data.error);

  return normalizeMlResponse(data);
}

/** Primary grading entry — ML backend first, heuristic fallback. */

export async function gradeEssayWithAI(input, rubricData) {
  const payload = normalizePayload(input, rubricData);
  const text = payload.content.trim();
  const prompt = payload.prompt || "";

  if (!text) {
    const result = gradeEssay("", payload.rubric);
    return {
      ...result,
      suggestions: ["Start writing your essay to get personalized feedback!"],
    };
  }

  if (!isValidLanguage(text)) {
    return {
      totalScore: 0,
      maxScore: 10,
      rubricScores: reconcileRubricScores([]).rubricScores,
      strengths: [],
      weaknesses: [],
      suggestions: [
        "Sorry, we can only grade essays in English or Filipino at this time.",
      ],
      errorMessage:
        "Unrecognized language. Please write in English or Filipino.",
      metadata: { engine: "rejected", reason: "invalid_language" },
    };
  }

  if (isGibberishText(text)) {
    return {
      totalScore: 0,
      maxScore: 10,
      rubricScores: reconcileRubricScores([]).rubricScores,
      strengths: [],
      weaknesses: [],
      suggestions: [
        "Please write meaningful text to receive feedback and a grade.",
      ],
      errorMessage: GIBBERISH_MESSAGE,
      metadata: { engine: "rejected", reason: "gibberish" },
    };
  }

  if (sentenceCount(text) < 2) {
    return {
      totalScore: 0,
      maxScore: 10,
      rubricScores: reconcileRubricScores([]).rubricScores,
      strengths: [],
      weaknesses: [],
      suggestions: [
        "Write a few more sentences so we can give you meaningful feedback!",
      ],
      errorMessage: ESSAY_TOO_SHORT_MESSAGE,
      metadata: { engine: "rejected", reason: "too_short" },
    };
  }

  try {
    console.debug("[AI] gradeEssayWithAI → ML backend");
    const result = await callMlEngine(payload);

    console.debug("[AI] ML success", {
      totalScore: result.totalScore,
      engine: result.metadata?.engine,
      language: result.metadata?.language,
    });

    // Ensure there are always suggestions
    if (!result.suggestions || result.suggestions.length === 0) {
      result.suggestions = [
        "Great work! Keep practicing to make your writing even better.",
      ];
    }

    return result;
  } catch (err) {
    console.warn("[AI] ML engine unavailable — heuristic fallback", err);

    return gradeEssay(payload.content, payload.rubric, prompt);
  }
}

export default gradeEssay;
