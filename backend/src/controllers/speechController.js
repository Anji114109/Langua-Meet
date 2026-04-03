import fs from "fs";
import { saveChunkToFile } from "../utils/audioConverter.js";
import { transcribeAudioChunk } from "../services/speechToTextService.js";

export const speechToTextController = async (req, res) => {
  try {
    // ✅ DEBUG LOG
    console.log("Received file:", req.file);

    if (!req.file) {
      return res.status(400).json({ error: "No audio file received" });
    }

    const audioBuffer = req.file.buffer;

    const filePath = saveChunkToFile(audioBuffer);
    const text = await transcribeAudioChunk(filePath);

    fs.unlinkSync(filePath);

    res.status(200).json({ text });
  } catch (error) {
    console.error("STT Error:", error.message);
    res.status(500).json({ error: "Speech to text failed" });
  }
};
