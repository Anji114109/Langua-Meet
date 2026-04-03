import dotenv from "dotenv";
dotenv.config();

export const WHISPER_CONFIG = {
  baseUrl: process.env.WHISPER_SERVICE_URL,
  endpoint: "/transcribe-chunk",
};
