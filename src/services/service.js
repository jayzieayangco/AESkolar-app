import { listEvaluations } from "./api.js";

/** @deprecated Use listEvaluations from ./api.js */
export const getDocuments = async () => {
  const { data, error } = await listEvaluations();
  if (error) console.error("Error fetching evaluations:", error);
  return data;
};
