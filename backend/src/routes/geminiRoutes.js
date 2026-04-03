import express from "express";
import { correctTranscriptController, modifySummaryController } from "../controllers/geminiController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/correct", requireAuth, correctTranscriptController);
router.post("/modify-summary", requireAuth, modifySummaryController);

export default router;
