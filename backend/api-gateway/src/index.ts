import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import { authenticateJWT, authorizeJWT } from "./access-control.ts";
import {
  createAttemptProxy,
  createCollabProxy,
  createMatchProxy,
  createQuestionProxy,
  createUserProxy,
} from "./proxy.ts";

dotenv.config();

const port = process.env.PORT || 8080;

const app = express();
// app.set('trust proxy', 1);

const DEFAULT_FRONTEND = "http://localhost:8000";
const frontend = process.env.FRONTEND_URL;

if (frontend) {
  console.log(`[CORS] Using configured FRONTEND_URL: ${frontend}`);
} else {
  console.warn(
    `[CORS] FRONTEND_URL not set, using default: ${DEFAULT_FRONTEND}`,
  );
}

app.use(
  cors({
    origin: frontend || DEFAULT_FRONTEND,
    credentials: true,
  }),
);
app.use(cookieParser());

// Add rate limiter
app.set('trust proxy', true);
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minutes
  max: 5000, // limit each IP to 5000 requests per windowMs
  standardHeaders: true, // return rate limit info in the RateLimit-* headers
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// user service routes - no authentication or authorization required
const userProxy = createUserProxy();
app.post("/user/register", userProxy);
app.post("/user/login", userProxy);
app.post("/user/refresh", userProxy);
app.post("/user/logout", userProxy);
// routes that require authorizeJWT middleware (e.g. protected resources)
app.patch("/user/:id", authorizeJWT, userProxy);
// default: all other routes require authenticateJWT middleware
app.use("/user", authenticateJWT, userProxy);

// attempt service routes
const attemptProxy = createAttemptProxy();
app.use("/attempt", authenticateJWT, attemptProxy);

// collab service routes
const collabProxy = createCollabProxy();
app.use("/collab", authenticateJWT, collabProxy);

// matching service routes
const matchProxy = createMatchProxy();
app.use("/match", authenticateJWT, matchProxy);

// question service routes
const questionProxy = createQuestionProxy();
app.use("/questionBank", authenticateJWT, questionProxy);

app.listen(port, () => {
  console.log(`API gateway running on port ${port}. Frontend URL: ${frontend}`);
});
