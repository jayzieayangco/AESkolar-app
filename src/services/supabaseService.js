/**
 * @deprecated Use `../services/api.js` for new code.
 * Re-exports legacy helpers mapped to the centralized API layer.
 */
import {
  getSession,
  listDocuments,
  uploadDocumentFile,
  downloadDocumentFile,
  getDocumentSignedUrl,
} from "./api.js";

export const getUserSession = getSession;

export async function fetchUserDocuments(userId, role) {
  return listDocuments({ userId, role });
}

export { uploadDocumentFile, downloadDocumentFile };

export const getDocumentPublicUrl = getDocumentSignedUrl;
