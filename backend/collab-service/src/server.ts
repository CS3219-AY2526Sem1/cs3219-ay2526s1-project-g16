import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import collabRoutes from "./routes/collab-routes.ts";
import { initConnection } from "./model/collab-model.ts";


dotenv.config();

const app = express();

// Use cors to allow any origin to access this app.
app.use(cors());

app.use(cookieParser());

app.use(express.json());

const port = process.env.PORT || 3009;

// Add collab routes
app.use("/", collabRoutes);

initConnection()
  .then(() => {
    app.listen(port, () => {
      console.log(`Collab service is running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
