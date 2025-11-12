import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { initConnection } from "./model/prisma-client.ts";
import userRoutes from "./routes/user-routes.ts";

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

const port = process.env.PORT || 3000;

// Add user routes
app.use("/", userRoutes);

initConnection()
  .then(() => {
    app.listen(port, () => {
      console.log(`User service is running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
