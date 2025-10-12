import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import questionRoutes from "./routes/question-routes.ts";
import { initConnection } from "./model/question-model.ts";

dotenv.config();

const app = express();

// Use cors to allow any origin to access this app.
app.use(cors());

app.use(express.json());

const port = process.env.PORT || 3000;

// Add user routes
app.use("/api/questions", questionRoutes);

initConnection()
    .then(() => {
        app.listen(port, () => {
            console.log(
                `Question service is running at http://localhost:${port}`,
            );
        });
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
