import axios from "axios";

const _axios = axios.create({
  baseURL: "https://api.cbkbeauty.expertech.dev/",
  headers: {
    "Content-Type": "application/json",
  },
});

export default _axios;