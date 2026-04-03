import express from "express";
import {
	firebaseAuthController,
	googleAuthController,
	meController,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/google", googleAuthController);
router.post("/firebase", firebaseAuthController);
router.get("/me", requireAuth, meController);

export default router;
