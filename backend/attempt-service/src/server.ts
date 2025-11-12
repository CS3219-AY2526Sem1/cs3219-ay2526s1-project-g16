import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import attemptRoutes from "./routes/attempt-routes.ts";
import { initConnection } from "./model/prisma-client.ts";

dotenv.config();

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

const port = process.env.PORT || 3003;

// Add attempt routes
app.use("/", attemptRoutes);

initConnection()
  .then(() => {
    app.listen(port, () => {
      console.log(`Attempt service is running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
