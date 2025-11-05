export const USER_SERVICE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_DEV_USER_SERVICE_URL
  : "http://34.142.162.255:8080/user";
export const QN_SERVICE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_DEV_QN_SERVICE_URL
  : "http://34.142.162.255:8080/questionBank";
export const MATCH_SERVICE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_DEV_MATCH_SERVICE_URL
  : "http://34.142.162.255:8080/match";
export const APIGATEWAY_URL = import.meta.env.DEV
  ? import.meta.env.VITE_APIGATEWAY_URL
  : "http://34.142.162.255:8080";