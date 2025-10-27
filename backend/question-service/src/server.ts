import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import questionRoutes from "./routes/question-routes.ts";
import topicRoutes from "./routes/topic-routes.ts";
import languageRoutes from "./routes/topic-routes.ts";
import { initConnection } from "./model/question-model.ts";

dotenv.config();

const app = express();

// Use cors to allow frontend URL to access this app.
app.use(cors({
  origin: 'http://localhost:8000', // frontend url
  credentials: true
}));

app.use(express.json());

const port = process.env.PORT || 3002;

// Add user routes
app.use("/api/questions", questionRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/languages", languageRoutes);

initConnection()
  .then(() => {
    app.listen(port, () => {
      console.log(`Question service is running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
