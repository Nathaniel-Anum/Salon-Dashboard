import axios from "axios";
import {
  announcePortalSuccess,
  isPortalRequest,
  preparePortalError,
  preparePortalResponse,
} from "./portalContract.js";

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "https://api.cbkbeauty.expertech.dev";

const _axios = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

//  Attach access token
_axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const LOGIN_PATH = "/api/portal/v1/accounts/login/";
const REFRESH_PATH = "/api/portal/v1/accounts/refresh/";
const refreshClient = axios.create({ baseURL: API_BASE_URL, headers: { "Content-Type": "application/json" } });
let refreshRequest = null;

function clearSession() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("portalSession");
  localStorage.removeItem("portalUser");
}

function endSession() {
  clearSession();
  if (window.location.pathname !== "/login") window.location.assign("/login");
}

function canRefresh(error) {
  const request = error?.config;
  return error?.response?.status === 401
    && isPortalRequest(request)
    && request?.url !== LOGIN_PATH
    && !request?._retry
    && Boolean(localStorage.getItem("refresh"));
}

function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = refreshClient
      .post(REFRESH_PATH, { refresh: localStorage.getItem("refresh") })
      .then((response) => {
        const access = response.data?.access;
        if (!access) throw new Error("The refresh response did not include an access token.");
        localStorage.setItem("access", access);
        return access;
      })
      .finally(() => { refreshRequest = null; });
  }
  return refreshRequest;
}

// Normalize successful portal responses and refresh an expired access token once.
_axios.interceptors.response.use(
  (response) => {
    const prepared = preparePortalResponse(response);
    announcePortalSuccess(prepared);
    return prepared;
  },
  async (error) => {
    const originalRequest = error.config;

    if (canRefresh(error)) {
      originalRequest._retry = true;

      try {
        const newAccess = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;

        return _axios(originalRequest);
      } catch {
        endSession();
      }
    }

    if (error.response?.status === 401 && originalRequest?.url !== LOGIN_PATH) {
      endSession();
    }

    return Promise.reject(preparePortalError(error));
  }
);

export default _axios;
