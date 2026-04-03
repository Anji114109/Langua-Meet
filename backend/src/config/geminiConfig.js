import dotenv from "dotenv";
dotenv.config();

export const GEMINI_CONFIG = {
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-pro",
};
