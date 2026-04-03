import express from "express";
import { getStreamTokenController } from "../controllers/streamController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/token", requireAuth, getStreamTokenController);

export default router;
