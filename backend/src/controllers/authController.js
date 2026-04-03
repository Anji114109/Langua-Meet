import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import { usersCollection } from "../db/collections.js";
import { signAppToken } from "../middleware/auth.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const toAlphaUsername = (email = "") => {
  const localPart = email.split("@")[0] || "user";
  const lettersOnly = localPart.replace(/[^a-zA-Z]/g, "").toLowerCase();
  return lettersOnly || "user";
};

export const googleAuthController = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: "Missing Google credential" });
    }

    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: "GOOGLE_CLIENT_ID is not configured" });
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload?.sub) {
      return res.status(401).json({ error: "Google token is invalid" });
    }

    const username = toAlphaUsername(payload.email);

    const userDoc = {
      google_id: payload.sub,
      email: payload.email,
      username,
      full_name: payload.name || username,
      avatar_url: payload.picture || null,
      updated_at: new Date(),
    };

    await usersCollection().updateOne(
      { google_id: payload.sub },
      {
        $set: userDoc,
        $setOnInsert: {
          created_at: new Date(),
        },
      },
      { upsert: true }
    );

    const appToken = signAppToken({
      userId: payload.sub,
      email: payload.email,
      username,
    });

    return res.json({
      token: appToken,
      user: {
        id: payload.sub,
        email: payload.email,
        username,
        fullName: payload.name || username,
        avatar: payload.picture || null,
      },
    });
  } catch (err) {
    console.error("Google auth error:", err.message);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

export const firebaseAuthController = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "Missing Firebase idToken" });
    }

    if (!FIREBASE_WEB_API_KEY) {
      return res.status(500).json({ error: "FIREBASE_WEB_API_KEY is not configured" });
    }

    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      { idToken }
    );

    const account = response?.data?.users?.[0];
    if (!account?.localId || !account?.email) {
      return res.status(401).json({ error: "Firebase token is invalid" });
    }

    const username = toAlphaUsername(account.email);

    const userDoc = {
      google_id: account.localId,
      email: account.email,
      username,
      full_name: account.displayName || username,
      avatar_url: account.photoUrl || null,
      updated_at: new Date(),
    };

    await usersCollection().updateOne(
      { google_id: account.localId },
      {
        $set: userDoc,
        $setOnInsert: {
          created_at: new Date(),
        },
      },
      { upsert: true }
    );

    const appToken = signAppToken({
      userId: account.localId,
      email: account.email,
      username,
    });

    return res.json({
      token: appToken,
      user: {
        id: account.localId,
        email: account.email,
        username,
        fullName: account.displayName || username,
        avatar: account.photoUrl || null,
      },
    });
  } catch (err) {
    const upstreamMessage =
      err.response?.data?.error?.message ||
      err.response?.data?.error?.errors?.[0]?.message ||
      err.message;
    const status = err.response?.status || 500;

    console.error("Firebase auth error:", status, upstreamMessage);

    if (status >= 400 && status < 500) {
      return res.status(401).json({ error: `Firebase auth failed: ${upstreamMessage}` });
    }

    return res.status(500).json({ error: `Firebase auth service error: ${upstreamMessage}` });
  }
};

export const meController = async (req, res) => {
  try {
    const user = await usersCollection().findOne(
      { google_id: req.user.userId },
      {
        projection: {
          _id: 0,
          google_id: 1,
          email: 1,
          username: 1,
          full_name: 1,
          avatar_url: 1,
        },
      }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: {
        id: user.google_id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        avatar: user.avatar_url,
      },
    });
  } catch (err) {
    console.error("Me route error:", err.message);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
};
