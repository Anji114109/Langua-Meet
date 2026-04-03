import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-pro-latest",
];

const generateWithFallbackModel = async ({ genAI, prompt }) => {
  let lastError = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      if (!text) {
        throw new Error("Gemini returned empty text");
      }

      return { text, modelName };
    } catch (err) {
      lastError = err;
      console.warn(`Gemini model failed (${modelName}):`, err.message);
    }
  }

  throw lastError || new Error("No Gemini model available");
};

export const correctTranscriptController = async (req, res) => {
  try {
    console.log("Incoming correction request");

    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing");
      return res.status(500).json({ error: "Gemini API key missing" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const prompt = `
Correct grammar, punctuation, capitalization, and numeric formatting.
Do NOT change meaning.
Do NOT add missing information.
Return only corrected text.

Transcript:
${text}
`;

    const { text: correctedText, modelName } = await generateWithFallbackModel({
      genAI,
      prompt,
    });

    console.log(`Gemini corrected successfully using ${modelName}`);

    return res.json({ correctedText, model: modelName });

  } catch (error) {
    console.error("Gemini correction error FULL:", error);
    return res.status(500).json({
      error: "Gemini correction failed",
      details: error.message,
    });
  }
};

export const modifySummaryController = async (req, res) => {
  try {
    console.log("Incoming summary modification request");

    const { summary } = req.body;

    if (!summary || !summary.trim()) {
      return res.status(400).json({ error: "Summary is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing");
      return res.status(500).json({ error: "Gemini API key missing" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const prompt = `
You are a professional editor. Improve the following summary by:
1. Correcting grammar, spelling, and punctuation
2. Improving sentence structure and clarity
3. Ensuring proper capitalization
4. Maintaining the original meaning and content
5. Keep it concise and professional

Summary:
${summary}
`;

    const { text: modifiedSummary, modelName } = await generateWithFallbackModel({
      genAI,
      prompt,
    });

    console.log(`Gemini summary modified successfully using ${modelName}`);

    return res.json({ modifiedSummary, model: modelName });

  } catch (error) {
    console.error("Gemini summary modification error:", error);
    return res.status(500).json({
      error: "Gemini summary modification failed",
      details: error.message,
    });
  }
};
