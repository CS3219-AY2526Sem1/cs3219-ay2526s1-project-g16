import type { Request, Response } from "express";
import { getAllLanguages } from "../model/language-model.ts";

/* returns list of all languages */
export const listLanguagesHandler = async (req: Request, res: Response) => {
  try {
    const languages = await getAllLanguages();
    res.status(200).json({
      count: languages.length,
      languages,
    });
  } catch (error) {
    console.error("Failed to retrieve languages:", error);
    res.status(500).json({ error: "Failed to fetch languages" });
  }
};
