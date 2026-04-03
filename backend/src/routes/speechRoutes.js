import express from "express";
import multer from "multer";
import { speechToTextController } from "../controllers/speechController.js";

const router = express.Router();
const upload = multer();

router.post("/speech-to-text", upload.single("audio"), speechToTextController);

export default router;
