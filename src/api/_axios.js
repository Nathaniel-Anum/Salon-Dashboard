import axios from "axios";
import {
  announcePortalSuccess,
  isPortalRequest,
  preparePortalError,
  preparePortalResponse,
} from "./portalContract.js";

const _axios = axios.create({
  baseURL: "https://api.cbkbeauty.expertech.dev/",
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

function clearSession() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
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
        const refresh = localStorage.getItem("refresh");
        const res = await axios.post(
          "https://api.cbkbeauty.expertech.dev/api/app/v1/accounts/refresh/",
          { refresh }
        );

        const newAccess = res.data.access;
        localStorage.setItem("access", newAccess);
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
