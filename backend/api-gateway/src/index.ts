import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from "dotenv";
import {
    createAttemptProxy,
    createCollabProxy,
    createUserProxy,
} from './proxy.ts';
import { authenticateJWT, authorizeJWT } from './access-control.ts';

dotenv.config();

const port = process.env.PORT || 8080;

const app = express();

const frontend = process.env.FRONTEND_URL || 'http://localhost:8000';
app.use(
  cors({
    origin: frontend,
    credentials: true,
  })
);
app.use(cookieParser());

// user service routes - no authentication or authorization required
const userProxy = createUserProxy();
app.post('/user/register', userProxy);
app.post('/user/login', userProxy);
app.post('/user/refresh', userProxy);
app.post('/user/logout', userProxy);
// routes that require authorizeJWT middleware (e.g. protected resources)
app.patch("/user/:id", authorizeJWT, userProxy);
// default: all other routes require authenticateJWT middleware
app.use('/user', authenticateJWT, userProxy);

// attempt service routes
const attemptProxy = createAttemptProxy();
app.use('/attempt', authenticateJWT, attemptProxy);

// collab service routes
const collabProxy = createCollabProxy();
app.use('/collab', authenticateJWT, collabProxy);


const server = app.listen(port, () => {
  console.log(`API gateway running on port ${port}. Frontend URL: ${frontend}`);
});