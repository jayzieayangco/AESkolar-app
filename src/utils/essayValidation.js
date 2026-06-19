/** Essay length / score helpers for editors and grading UI. */

export const MAX_ESSAY_SCORE = 10;
export const MIN_SENTENCES_FOR_SUBMIT = 2;

export function countSentences(text) {
  if (!text?.trim()) return 0;
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

export function isEssayTooShort(text, minSentences = MIN_SENTENCES_FOR_SUBMIT) {
  return countSentences(text) < minSentences;
}

export function essayTooShortMessage() {
  return "Essay too short to grade.";
}

export function clampScore(score, max = MAX_ESSAY_SCORE) {
  const n = Number(score);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(max, n));
}

export function documentPreview(content, maxLen = 100) {
  const plain = String(content ?? "").replace(/\s+/g, " ").trim();
  if (!plain) return "No preview yet.";
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen)}…`;
}
