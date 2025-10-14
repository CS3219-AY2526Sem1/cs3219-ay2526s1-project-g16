export const USER_SERVICE_URL = import.meta.env.DEV
  ? "http://localhost:3000/user"
  : "";

export const QN_SERVICE_URL = import.meta.env.DEV
  ? "http://localhost:3001/api/questions"
  : "";

export const ACCESS_TOKEN = "accessToken";
