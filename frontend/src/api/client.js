import axios from "axios";

const ACCESS_TOKEN_KEY = "courseapp.accessToken";
const REFRESH_TOKEN_KEY = "courseapp.refreshToken";

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  save({ accessToken, refreshToken }) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

function getBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl) return "/api/v1";
  const trimmed = envUrl.trim().replace(/\/+$/, "");
  if (!trimmed.endsWith("/api/v1")) {
    return `${trimmed}/api/v1`;
  }
  return trimmed;
}

export const api = axios.create({
  baseURL: getBaseUrl(),
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * On a 401, try the refresh token once and replay the original request.
 * `_retried` stops a failed refresh from looping.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.startsWith("/auth/");

    if (error.response?.status !== 401 || isAuthCall || original?._retried) {
      return Promise.reject(error);
    }

    const refreshToken = tokenStore.refresh;
    if (!refreshToken) return Promise.reject(error);

    try {
      const { data } = await axios.post(
        `${api.defaults.baseURL}/auth/refresh`,
        { refreshToken },
        { headers: { "Content-Type": "application/json" } },
      );
      tokenStore.save({ accessToken: data.data.accessToken });
      original._retried = true;
      return api(original);
    } catch (refreshError) {
      tokenStore.clear();
      return Promise.reject(refreshError);
    }
  },
);

/** Every backend error uses `{ error: { code, message, details } }`. */
export function getApiErrorMessage(error) {
  return (
    error?.response?.data?.error?.message ?? "Something went wrong. Please try again."
  );
}

/** Publication failures carry a list of reasons in `details.problems`. */
export function getApiErrorProblems(error) {
  return error?.response?.data?.error?.details?.problems ?? [];
}
