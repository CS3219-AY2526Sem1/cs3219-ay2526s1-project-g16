export const USER_SERVICE_URL = import.meta.env.DEV
  ? "http://localhost:3000"
  : "";

export const QN_SERVICE_URL = import.meta.env.DEV
  ? "http://localhost:3001/api"
  : "";

export const MATCH_SERVICE_URL = import.meta.env.DEV
  ? "http://localhost:3002"
  : "";
