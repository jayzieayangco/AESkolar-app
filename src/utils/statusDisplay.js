/** Human-readable labels for document / evaluation workflow states. */

const DOCUMENT_STATUS = {
  draft: "Draft",
  submitted: "Pending",
  scored: "Drafted",
  graded: "Released",
  trash: "Trash",
};

const EVALUATION_STATUS = {
  pending: "Pending",
  scored: "Grading in Progress",
  released: "Graded",
};

export function formatDocumentStatus(status) {
  if (!status) return "Draft";
  return DOCUMENT_STATUS[status] ?? status;
}

export function formatEvaluationStatus(status) {
  if (!status) return "Pending";
  return EVALUATION_STATUS[status] ?? status;
}
