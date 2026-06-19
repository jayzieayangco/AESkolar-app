/** Strict 10-point rubric: Content 4, Organization 3, Language 2, Mechanics 1 */

export const RUBRIC_SLOTS = [
  { id: "content", name: "Content", maxScore: 4 },
  { id: "organization", name: "Organization", maxScore: 3 },
  { id: "language", name: "Language", maxScore: 2 },
  { id: "mechanics", name: "Mechanics", maxScore: 1 },
];

const MAX_TOTAL = 10;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function roundHalf(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.round(x * 2) / 2;
}

function slotKey(row) {
  const id = String(row?.id ?? row?.name ?? "").toLowerCase();
  if (id.includes("content") || id.includes("ideas")) return "content";
  if (id.includes("organ") || id.includes("structure")) return "organization";
  if (id.includes("language") || id.includes("style") || id.includes("voice"))
    return "language";
  if (
    id.includes("mech") ||
    id.includes("grammar") ||
    id.includes("convention")
  )
    return "mechanics";
  return null;
}

/**
 * Normalizes rubric rows to fixed max scores; ensures total equals sum of parts (≤ 10).
 */
export function reconcileRubricScores(incoming = []) {
  const mapped = {};
  for (const row of incoming) {
    const key = slotKey(row);
    if (key) mapped[key] = row;
  }

  const rubricScores = RUBRIC_SLOTS.map((slot) => {
    const src = mapped[slot.id];
    // Clamp score to maxScore and round to half point for display
    const score = roundHalf(clamp(Number(src?.score ?? 0), 0, slot.maxScore));
    return {
      id: slot.id,
      name: slot.name,
      score,
      maxScore: slot.maxScore,
    };
  });

  // Calculate total score by summing individual rubric scores
  let totalScore = rubricScores.reduce((sum, r) => sum + r.score, 0);

  // Round total score to nearest half point for display
  totalScore = roundHalf(totalScore);

  if (totalScore > MAX_TOTAL) {
    const factor = MAX_TOTAL / totalScore;
    rubricScores.forEach((r) => {
      r.score = roundHalf(r.score * factor);
    });
    totalScore = roundHalf(rubricScores.reduce((sum, r) => sum + r.score, 0));
  }

  return {
    rubricScores,
    totalScore,
    maxScore: MAX_TOTAL,
  };
}

const GIBBERISH_PATTERNS = [
  /^asdf+$/i,
  /^qwerty/i,
  /^zxcv/i,
  /^hjkl/i,
  /^(.)\1{4,}$/,
  /^[bcdfghjklmnpqrstvwxyz]{5,}$/i,
];

export function isGibberishText(text) {
  const tokens = String(text ?? "")
    .toLowerCase()
    .match(/[a-z]{3,}/g);
  if (!tokens || tokens.length < 2) return false;

  let suspicious = 0;
  for (const token of tokens) {
    if (GIBBERISH_PATTERNS.some((p) => p.test(token))) {
      suspicious += 1;
      continue;
    }
    if (!/[aeiouy]/.test(token) && token.length >= 4) suspicious += 1;
    if (/^[a-z]{2,}[0-9]+[a-z]*$/i.test(token)) suspicious += 1;
  }

  return suspicious / tokens.length >= 0.35;
}

export const GIBBERISH_MESSAGE =
  "Please type meaningful words to receive a grade.";

export const ESSAY_TOO_SHORT_MESSAGE = "Essay too short to grade.";
