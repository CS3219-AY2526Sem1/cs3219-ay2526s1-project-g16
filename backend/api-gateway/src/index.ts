import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from "dotenv";

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
app.use(express.json());

const server = app.listen(port, () => {
  console.log(`API gateway running on port ${port}. Frontend URL: ${frontend}`);
});