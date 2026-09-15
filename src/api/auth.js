import _axios from "./_axios";

export const loginUser = async (data) => {
  const storageKey = "portalDeviceId";
  let deviceId = localStorage.getItem(storageKey);
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(storageKey, deviceId);
  }
  const response = await _axios.post(
    "/api/portal/v1/accounts/login/",
    {
      email: data.email,
      password: data.password,
      device_id: `portal-web:${deviceId}`,
      device_name: "Operations Portal",
    }
  );

  return response.data;
};
