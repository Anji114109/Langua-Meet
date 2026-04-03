import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { WHISPER_CONFIG } from "../config/whisperConfig.js";

export const transcribeWithLocalWhisper = (audioFilePath) => {
    return new Promise((resolve, reject) => {
        const command = `${WHISPER_CONFIG.binaryPath} "${audioFilePath}" --model ${WHISPER_CONFIG.model} --language ${WHISPER_CONFIG.language} --output_format txt`;

        exec(command, (error) => {
            if (error) {
                return reject(error);
            }

            const outputTxt = audioFilePath.replace(
                path.extname(audioFilePath),
                ".txt"
            );

            fs.readFile(outputTxt, "utf-8", (err, data) => {
                if (err) return reject(err);
                resolve(data.trim());
            });
        });
    });
};
