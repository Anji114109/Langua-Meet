import fs from "fs";
import path from "path";

export const saveChunkToFile = (buffer) => {
  const fileName = `chunk_${Date.now()}.wav`;
  const filePath = path.join("temp", fileName);

  fs.mkdirSync("temp", { recursive: true });
  fs.writeFileSync(filePath, buffer);

  return filePath;
};
