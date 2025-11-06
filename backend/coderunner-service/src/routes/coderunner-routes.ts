import express from "express";
import { runCodeHandler } from "../controller/coderunner-controller.ts";

export const runRoutes = express.Router();

runRoutes.post("/run", runCodeHandler);
runRoutes.get("/health", (_req, res) => res.json({ status: "ok" }));
