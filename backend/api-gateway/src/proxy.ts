import { createProxyMiddleware } from 'http-proxy-middleware';

export const createUserProxy = () =>
  createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    changeOrigin: true,
    logger: console,
    pathRewrite: {
      '^/user': '', // Remove /user prefix
    },
    on: {
      proxyReq: (proxyReq, req, res) => {
        const targetUrl = `${process.env.USER_SERVICE_URL}${req.url}`;
        console.log(`[Proxy] ${req.method} ${req.url} -> ${targetUrl}`);
      }
    }
  });

export const createAttemptProxy = () =>
  createProxyMiddleware({
    target: process.env.ATTEMPT_SERVICE_URL,
    changeOrigin: true,
    logger: console,
    pathRewrite: {
      '^/attempt': '', // Remove /attempt prefix
    },
    on: {
      proxyReq: (proxyReq, req, res) => {
        const targetUrl = `${process.env.ATTEMPT_SERVICE_URL}${req.url}`;
        console.log(`[Proxy] ${req.method} ${req.url} -> ${targetUrl}`);
      }
    }
  });