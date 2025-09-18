import axios from "axios";

const api = axios.create({
  baseUrl: "https://google.com",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
