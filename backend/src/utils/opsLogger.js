import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "operations.log");

const ensureLogDir = () => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
};

export const logOperation = (event, payload = {}) => {
  try {
    ensureLogDir();
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...payload,
    });
    fs.appendFileSync(LOG_FILE, `${line}\n`, "utf8");
  } catch (err) {
    console.error("Operation logger error:", err.message);
  }
};
