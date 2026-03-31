import axios from "axios";

// const _axios = axios.create({
//   baseURL: "https://api.cbkbeauty.expertech.dev/",
//   headers: {
//     "Content-Type": "application/json",
//   },
// });

// // Axios interceptor
// _axios.interceptors.request.use(
//   (config) => {
//     const token = localStorage.getItem("access");

//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }

//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// export default _axios;




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

// Handle refresh on 401
_axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refresh = localStorage.getItem("refresh");

        //  Call refresh endpoint
        const res = await axios.post(
          "https://api.cbkbeauty.expertech.dev/api/app/v1/accounts/refresh/",
          { refresh }
        );

        const newAccess = res.data.access;

        // Save new token
        localStorage.setItem("access", newAccess);

        //  Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;

        return _axios(originalRequest);
      } catch (refreshError) {
        //  Refresh failed → logout
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default _axios;