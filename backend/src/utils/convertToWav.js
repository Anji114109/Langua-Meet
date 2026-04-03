import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

export const convertToWav = (inputPath) => {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(dir, `${baseName}.wav`);

    console.log("🎛️ Starting FFmpeg conversion...");
    console.log("📂 Input:", inputPath);
    console.log("📂 Output:", outputPath);

    ffmpeg(inputPath)
      .audioCodec("pcm_s16le")   // 🔥 VERY IMPORTANT
      .audioChannels(1)          // mono
      .audioFrequency(16000)     // 16kHz
      .format("wav")
      .on("start", (cmd) => {
        console.log("🚀 FFmpeg command:", cmd);
      })
      .on("end", () => {
        console.log("✅ FFmpeg conversion finished");

        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log("📏 Final WAV size:", stats.size, "bytes");
        }

        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("🔥 FFmpeg error:", err.message);
        reject(err);
      })
      .save(outputPath);
  });
};
