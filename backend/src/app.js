import express from "express";
import cors from "cors";
import streamRoutes from "./routes/streamRoutes.js";
import geminiRoutes from "./routes/geminiRoutes.js";
import transcriptRoutes from "./routes/transcript.routes.js";
import transcriptModifyRoutes from "./routes/transcriptModifyRoutes.js";
import historyRoutes from "./routes/history.routes.js";
import pdfRoutes from "./routes/pdf.routes.js";
import authRoutes from "./routes/auth.routes.js";
import speechRoutes from "./routes/speechRoutes.js";
const app = express();

app.use(cors());
app.use(express.json());

// Keep stream routes (for Stream token etc.)
app.use("/api/auth", authRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/gemini", geminiRoutes);
app.use("/api/transcript", transcriptRoutes);
app.use("/api/transcript", transcriptModifyRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api", speechRoutes);
app.get("/", (req, res) => {
  res.json({ status: "Backend running (Streaming Mode)" });
});

export default app;
