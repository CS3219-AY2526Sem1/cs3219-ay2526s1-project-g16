import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import cookieParser from "cookie-parser"; 

import matchRoutes from "./routes/match-routes.ts";
import { initConnection } from "./model/match-model.ts";
import { initMatchRedisBridge } from "./controller/match-SSE.ts";

dotenv.config();

const app = express();

app.use(cookieParser());       

const frontend = process.env.FRONTEND_URL || 'http://localhost:8000';
app.use(
  cors({
    origin: frontend,
    credentials: true,
  })
);

app.use(express.json());

const port = Number(process.env.PORT) || 3010;

app.use("/", matchRoutes);

app.get("/", (_req, res) => {
  res.send("Server is up and running 🚀");
});

(async () => {
  try {
    await initConnection();
    await initMatchRedisBridge();

    app.listen(port, "0.0.0.0", () => {
      console.log(`Match service listening on 0.0.0.0:${port}`);
    });
  } catch (err) {
    console.error("[bootstrap] failed to start:", err);
    process.exit(1);
  }
})();
