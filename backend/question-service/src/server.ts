import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { initConnection } from "./model/question-model.ts";
import languageRoutes from "./routes/languages-routes.ts";
import questionRoutes from "./routes/question-routes.ts";
import topicRoutes from "./routes/topic-routes.ts";

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

const port = Number(process.env.PORT) || 3002;

// Add question routes
app.use("/questions", questionRoutes);
app.use("/topics", topicRoutes);
app.use("/languages", languageRoutes);

initConnection()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`Question service listening on 0.0.0.0:${port}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
