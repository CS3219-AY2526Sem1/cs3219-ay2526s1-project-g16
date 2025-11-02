import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from "dotenv";
import {
    createAttemptProxy,
    createCollabProxy,
    createMatchProxy,
    createQuestionProxy,
    createUserProxy,
} from './proxy.ts';
import { authenticateJWT, authorizeJWT } from './access-control.ts';
import rateLimit from 'express-rate-limit';

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

// Add rate limiter
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // return rate limit info in the RateLimit-* headers
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

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

// matching service routes
const matchProxy = createMatchProxy();
app.use('/match', authenticateJWT, matchProxy);

// question service routes
const questionProxy = createQuestionProxy();
app.use('/questionBank', authenticateJWT, questionProxy);

app.listen(port, () => {
  console.log(`API gateway running on port ${port}. Frontend URL: ${frontend}`);
});