import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import userRoutes from "./routes/user-routes.ts";
import { initConnection } from "./model/prisma-client.ts";

dotenv.config();

const app = express();

// Use cors to allow any origin to access this app.
app.use(
  cors({
    origin: "http://localhost:8000", // frontend url
    credentials: true,
  }),
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
