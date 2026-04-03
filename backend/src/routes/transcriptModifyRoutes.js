import express from "express";
import axios from "axios";
import { logOperation } from "../utils/opsLogger.js";
import { requireAuth } from "../middleware/auth.js";
import { hasMeetingAccess } from "../services/meetingPersistenceService.js";

const router = express.Router();

// 🔥 Trigger auto-modification of transcript when user leaves meeting
router.post("/:meetingId/modify", requireAuth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user?.userId;

    if (!meetingId) {
      return res.status(400).json({ error: "Meeting ID is required" });
    }

    const allowed = await hasMeetingAccess({ meetingId, userId });
    if (!allowed) {
      return res.status(403).json({ error: "Forbidden" });
    }

    logOperation("transcript_modify_requested", { meetingId });

    // Call the Python service to modify the transcript
    const response = await axios.post(
      `http://127.0.0.1:8000/modify-transcript/${meetingId}`
    );

    console.log(`✅ Transcript modify response for meeting ${meetingId}:`, response.data);
    logOperation("transcript_modify_response", {
      meetingId,
      upstreamStatus: response.status,
      upstreamData: response.data,
    });

    return res.json({
      status: response.data?.status || "success",
      message: response.data?.message || "Transcript modification triggered successfully",
      meetingId,
      source: "python-service",
      detail: response.data?.detail || null,
      modifiedCount: response.data?.modified_count ?? null,
    });
  } catch (err) {
    const upstreamStatus = err.response?.status;
    const upstreamMessage = err.response?.data?.error || err.message;

    if (upstreamStatus === 404) {
      console.log(`⚠️ No transcript found for meeting: ${req.params.meetingId}`);
      // Not an error - transcript might not exist yet
      logOperation("transcript_modify_not_found", {
        meetingId: req.params.meetingId,
      });
      return res.status(404).json({ error: "No transcript found for this meeting" });
    }

    console.error("Transcript modify warning:", upstreamStatus || 500, upstreamMessage);
    logOperation("transcript_modify_skipped", {
      meetingId: req.params.meetingId,
      upstreamStatus: upstreamStatus || 500,
      upstreamMessage,
    });
    return res.status(200).json({
      status: "skipped",
      message: "Transcript modification unavailable, continuing with original transcript",
      meetingId: req.params.meetingId,
      detail: upstreamMessage,
    });
  }
});

export default router;
