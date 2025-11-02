export const USER_SERVICE_URL = import.meta.env.DEV
  ? process.env.VITE_DEV_USER_SERVICE_URL
  : `${import.meta.env.VITE_APIGATEWAY_URL}/user`;
export const QN_SERVICE_URL = import.meta.env.DEV
  ? process.env.VITE_DEV_QN_SERVICE_URL
  : `${import.meta.env.VITE_APIGATEWAY_URL}/question`;
export const MATCH_SERVICE_URL = import.meta.env.DEV
  ? process.env.VITE_DEV_MATCH_SERVICE_URL
  : `${import.meta.env.VITE_APIGATEWAY_URL}/match`;
