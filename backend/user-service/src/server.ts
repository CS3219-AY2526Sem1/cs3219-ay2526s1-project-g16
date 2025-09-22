import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import userRoutes from "./routes/user-routes.ts";
import { initConnection } from "./model/user-model.ts";

dotenv.config();

const app = express();

// Use cors to allow any origin to access this app.
app.use(cors());

app.use(express.json());

const port = process.env.PORT || 3000;

// Add user routes
app.use("/user", userRoutes);

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
