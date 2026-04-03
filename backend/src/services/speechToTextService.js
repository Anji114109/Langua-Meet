import { transcribeWithLocalWhisper } from "./localWhisperService.js";

export const transcribeAudioChunk = async (filePath) => {
  return transcribeWithLocalWhisper(filePath);
};
