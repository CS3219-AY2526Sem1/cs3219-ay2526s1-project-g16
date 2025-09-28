import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import matchRoutes from "./routes/match-routes.ts";
import { initConnection } from "./model/match-model.ts";

dotenv.config();

const app = express();

// CORS (tighten as needed)
app.use(cors());

app.use(express.json());

const port = Number(process.env.PORT) || 3000;

// // Mount match routes at /match
app.use("/match", matchRoutes);

app.get("/", (_req, res) => {
  res.send("Server is up and running 🚀");
});

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
