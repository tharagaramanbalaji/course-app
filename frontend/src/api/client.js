import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  headers: { "Content-Type": "application/json" },
});

/**
 * Every backend error uses the envelope:
 *   { error: { code, message, details } }
 *
 * @param {unknown} error
 * @returns {string} a message safe to show the user
 */
export function getApiErrorMessage(error) {
  return error?.response?.data?.error?.message ?? "Something went wrong. Please try again.";
}
