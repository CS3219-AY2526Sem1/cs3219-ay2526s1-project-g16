import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import matchRoutes from "./routes/match-routes.ts";
import { initConnection } from "./model/match-model.ts";
import { startPgEvents } from "./controller/match-pg-listener.ts";
import { startMatchSweeper } from "./controller/match-sweeper.ts";

dotenv.config();

const app = express();

// Use cors to allow frontend URL to access this app.
app.use(
  cors({
    origin: "http://localhost:8000", // frontend url
    credentials: true,
  }),
);

app.use(express.json());

const port = Number(process.env.PORT) || 3001;

app.use("/match", matchRoutes);

app.get("/", (_req, res) => {
  res.send("Server is up and running 🚀");
});

(async () => {
  try {
    await initConnection();
    // Start push events (LISTEN/NOTIFY) and the sweeper
    await startPgEvents();

    if (process.env.ENABLE_SWEEPER !== "0") {
      await startMatchSweeper();
    }

    app.listen(port, () => {
      console.log(`User service is running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error("[bootstrap] failed to start:", err);
    process.exit(1);
  }
})();
