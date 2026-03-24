import _axios from "./_axios";

export const loginUser = async (data) => {
  const response = await _axios.post(
    "/api/portal/v1/accounts/login/",
    {
      email: data.email,
      password: data.password,
      device_id: "portal-web",     
      device_name: "Portal",       
    }
  );

  return response.data;
};