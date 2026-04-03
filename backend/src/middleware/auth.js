import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET_KEY;

export const signAppToken = (payload) => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET_KEY is missing in environment variables");
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });
};

export const verifyAppToken = (token) => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET_KEY is missing in environment variables");
  }

  return jwt.verify(token, JWT_SECRET);
};

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = verifyAppToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
