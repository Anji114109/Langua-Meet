import { generateStreamToken } from "../lib/stream.js";

export const getStreamTokenController = (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(400).json({ error: "User ID required" });
  }

  const token = generateStreamToken(userId);
  res.status(200).json({ token });
};
