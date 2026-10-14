import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

// The access token lives in memory only (never localStorage), so XSS cannot
// steal a long-lived credential. The refresh token is an httpOnly cookie.
let accessToken = null;
let onAuthFailure = () => {};

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token;
};
export const setAuthFailureHandler = (fn) => {
  onAuthFailure = fn;
};

const api = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

/**
 * Single-flight refresh: if 5 requests fail with 401 at once they all share ONE
 * refresh call. This matters because the server rotates refresh tokens;
 * parallel refreshes would look like token reuse and end the session.
 */
let refreshPromise = null;
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        setAccessToken(res.data.data.accessToken);
        return res.data.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const isAuthCall = config?.url?.startsWith('/auth/');
    if (response?.status === 401 && config && !config._retry && !isAuthCall) {
      config._retry = true;
      try {
        await refreshSession();
        return api(config);
      } catch {
        onAuthFailure();
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(err) {
  if (!err?.response) return 'Cannot reach the server. Please check your connection.';
  const { message, errors } = err.response.data || {};
  if (errors?.length) return `${message}: ${errors.map((e) => e.message).join(', ')}`;
  return message || 'Something went wrong. Please try again.';
}

export default api;
