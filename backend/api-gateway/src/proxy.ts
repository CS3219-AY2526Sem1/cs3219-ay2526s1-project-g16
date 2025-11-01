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

export const createCollabProxy = () =>
  createProxyMiddleware({
    target: process.env.COLLAB_SERVICE_URL,
    changeOrigin: true,
    ws: true,
    logger: console,
    on: {
      proxyReq: (proxyReq, req, res) => {
        const targetUrl = `${process.env.COLLAB_SERVICE_URL}${req.url}`;
        console.log(`[Proxy] ${req.method} ${req.url} -> ${targetUrl}`);
      }
    }
  });

export const createMatchProxy = () =>
  createProxyMiddleware({
    target: process.env.MATCHING_SERVICE_URL,
    changeOrigin: true,
    logger: console,
    pathRewrite: {
      '^/': '/match/', 
    },
    on: {
      proxyReq: (proxyReq, req, res) => {
        const targetUrl = `${process.env.MATCHING_SERVICE_URL}${req.url}`;
        console.log(`[Proxy] ${req.method} ${req.url} -> ${targetUrl}`);
      }
    }
  });

export const createQuestionProxy = () =>
  createProxyMiddleware({
    target: process.env.QUESTION_SERVICE_URL,
    changeOrigin: true,
    logger: console,
    pathRewrite: {
      '^/questionBank': '', // Remove /questionBank prefix
    },
    on: {
      proxyReq: (proxyReq, req, res) => {
        const targetUrl = `${process.env.QUESTION_SERVICE_URL}${req.url}`;
        console.log(`[Proxy] ${req.method} ${req.url} -> ${targetUrl}`);
      }
    }
  });