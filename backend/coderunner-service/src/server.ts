import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import cookieParser from "cookie-parser";

import { runRoutes } from "./routes/coderunner-routes.ts";

dotenv.config();

const app = express();

app.use(cookieParser());

const frontend = process.env.FRONTEND_URL || "http://localhost:8000";
app.use(
  cors({
    origin: frontend,
    credentials: true,
  })
);

app.use(express.json({ limit: "64kb" }));

app.use("/", runRoutes);

app.get("/", (_req, res) => {
  res.send("CodeRunner service is up and running 🚀");
});

(async () => {
  try {
    const port = Number(process.env.PORT) || 3005;

    app.listen(port, "0.0.0.0", () => {
      console.log(`✅ CodeRunner listening on 0.0.0.0:${port}`);
      console.log(`Frontend allowed origin: ${frontend}`);
    });
  } catch (err) {
    console.error("[bootstrap] Failed to start:", err);
    process.exit(1);
  }
})();
