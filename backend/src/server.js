import dotenv from "dotenv";
import http from "http";
import app from "./app.js";
import os from "os";
import { Server } from "socket.io";
import {
  closeWhisperConnection,
  connectToWhisper,
  sendAudioChunk,
  sendLanguageUpdate,
} from "./sockets/pythonSocketClient.js";
import { connectMongo } from "./db/mongo.js";
import { ensureIndexes } from "./db/setupIndexes.js";
import { verifyAppToken } from "./middleware/auth.js";
import {
  ensureMeetingForHost,
  markParticipantLeft,
  upsertMeetingParticipant,
} from "./services/meetingPersistenceService.js";
import { closeMongo } from "./db/mongo.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 60000,
  pingInterval: 25000,
});

global.io = io;

const meetingHosts = new Map();
const pendingJoinRequests = new Map();

const REQUEST_TTL_MS = 2 * 60 * 1000;
const MEETING_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{5,79}$/;

const isValidMeetingId = (value) =>
  typeof value === "string" && MEETING_ID_REGEX.test(value.trim());

const sanitizeName = (value, fallback = "Guest") => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 80);
};

setInterval(() => {
  const now = Date.now();

  for (const [requestId, request] of pendingJoinRequests.entries()) {
    if (now - request.createdAt < REQUEST_TTL_MS) continue;

    pendingJoinRequests.delete(requestId);
    io.to(request.requesterSocketId).emit("join-response", {
      accepted: false,
      meetingId: request.meetingId,
      reason: "Join request timed out. Please request again.",
      hostName: meetingHosts.get(request.meetingId)?.hostName || "Host",
    });
  }
}, 30 * 1000);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Unauthorized"));
    }

    socket.user = verifyAppToken(token);
    return next();
  } catch (err) {
    return next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  console.log("🟢 Browser connected:", socket.id);

  let meetingId = null;
  let speakerId = null;

  // 🔥 When user joins meeting
  socket.on("join-meeting", async ({ meeting_id, speaker_id, display_name, role }) => {
    if (!isValidMeetingId(meeting_id)) {
      socket.emit("join-error", { reason: "Invalid meeting ID format." });
      return;
    }

    const normalizedRole = ["host", "member", "guest"].includes(role) ? role : "guest";

    meetingId = meeting_id.trim();
    speakerId = typeof speaker_id === "string" && speaker_id.trim() ? speaker_id.trim().slice(0, 120) : socket.id;

    socket.join(meetingId);

    console.log(`🎯 ${socket.id} joined meeting ${meetingId}`);

    await upsertMeetingParticipant({
      meetingId,
      userId: socket.user?.userId || speakerId,
      displayName: sanitizeName(display_name, socket.user?.username || "Guest"),
      role: normalizedRole,
      socketId: socket.id,
    });

    // 🔥 Connect Python ASR for this meeting
    connectToWhisper({
      connectionId: socket.id,
      meetingId,
      speakerId,
      displayName: sanitizeName(display_name, socket.user?.username || "Guest"),
    });
  });

  socket.on("register-host", async ({ meetingId: roomId, hostName, hostId, meetingSubject }) => {
    if (!isValidMeetingId(roomId)) {
      socket.emit("host-registration-error", { reason: "Invalid meeting ID format." });
      return;
    }

    const normalizedRoomId = roomId.trim();
    const normalizedHostName = sanitizeName(hostName, socket.user?.username || "Host");

    try {
      await ensureMeetingForHost({
        meetingId: normalizedRoomId,
        hostId: socket.user?.userId || hostId,
        hostName: normalizedHostName,
        subject: meetingSubject || "General Discussion",
      });
    } catch (err) {
      if (err.code === "MEETING_HOST_CONFLICT") {
        socket.emit("host-registration-error", {
          reason: "Meeting already belongs to another host.",
        });
        return;
      }

      console.error("Host registration persistence error:", err.message);
      socket.emit("host-registration-error", {
        reason: "Failed to register host for this meeting.",
      });
      return;
    }

    meetingHosts.set(normalizedRoomId, {
      socketId: socket.id,
      hostName: normalizedHostName,
      hostId: hostId || socket.id,
      meetingSubject: meetingSubject || "General Discussion",
    });

    socket.join(`host:${normalizedRoomId}`);
    console.log(`👑 Host registered for ${normalizedRoomId}: ${socket.id}`);

    await upsertMeetingParticipant({
      meetingId: normalizedRoomId,
      userId: socket.user?.userId || hostId,
      displayName: normalizedHostName,
      role: "host",
      socketId: socket.id,
    });
  });

  socket.on("request-join", ({ meetingId: roomId, requesterName, requesterId }) => {
    if (!roomId) return;

    const hostInfo = meetingHosts.get(roomId);
    if (!hostInfo?.socketId) {
      socket.emit("join-response", {
        accepted: false,
        reason: "Host is not available. Try again in a moment.",
        hostName: null,
      });
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    pendingJoinRequests.set(requestId, {
      requesterSocketId: socket.id,
      meetingId: roomId,
      requesterName: requesterName || "Guest",
      requesterId: requesterId || socket.id,
      createdAt: Date.now(),
    });

    io.to(hostInfo.socketId).emit("join-request", {
      requestId,
      meetingId: roomId,
      requesterName: requesterName || "Guest",
      requesterId: requesterId || socket.id,
    });
  });

  socket.on("respond-join-request", ({ requestId, accepted }) => {
    const request = pendingJoinRequests.get(requestId);
    if (!request) return;

    pendingJoinRequests.delete(requestId);

    io.to(request.requesterSocketId).emit("join-response", {
      accepted: !!accepted,
      meetingId: request.meetingId,
      reason: accepted ? null : "Host declined your request.",
      hostName: meetingHosts.get(request.meetingId)?.hostName || "Host",
      meetingSubject: meetingHosts.get(request.meetingId)?.meetingSubject || "General Discussion",
    });
  });

  // 🔥 Audio streaming
  socket.on("audio-chunk", (chunk) => {
    if (!meetingId) return;
    sendAudioChunk(socket.id, chunk);
  });

  // 🔥 Language switching
  socket.on("set-language", (lang) => {
    if (!meetingId) return;

    console.log(`🌍 ${socket.id} selected language:`, lang);
    sendLanguageUpdate(socket.id, lang);
  });

  socket.on("disconnect", () => {
    closeWhisperConnection(socket.id);

    if (meetingId) {
      markParticipantLeft({ meetingId, socketId: socket.id }).catch((err) => {
        console.error("Participant leave persistence error:", err.message);
      });
    }

    for (const [roomId, hostInfo] of meetingHosts.entries()) {
      if (hostInfo.socketId === socket.id) {
        meetingHosts.delete(roomId);
      }
    }

    for (const [requestId, request] of pendingJoinRequests.entries()) {
      if (request.requesterSocketId === socket.id) {
        pendingJoinRequests.delete(requestId);
      }
    }

    console.log("🔴 Browser disconnected:", socket.id);
  });
});

// 🔥 Get local IP
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
};

const localIP = getLocalIP();

const tryReachExistingBackend = async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/`, {
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) return false;
    const payload = await response.json();

    return payload?.status?.includes("Backend running") || false;
  } catch {
    return false;
  }
};

const listenAsync = (port) =>
  new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off("listening", onListening);
      reject(err);
    };

    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "0.0.0.0");
  });

const startServer = async () => {
  await connectMongo();
  await ensureIndexes();

  try {
    await listenAsync(PORT);
    console.log("🚀 Backend running at:");
    console.log(`👉 Local:   http://localhost:${PORT}`);
    console.log(`👉 Network: http://${localIP}:${PORT}`);
  } catch (err) {
    if (err?.code === "EADDRINUSE") {
      const existingBackend = await tryReachExistingBackend();
      if (existingBackend) {
        console.log(`ℹ Backend already running on port ${PORT}.`);
        console.log("ℹ Skipping duplicate instance start.");
        await closeMongo();
        process.exit(0);
      }

      throw new Error(
        `Port ${PORT} is already in use by another process. Free the port or change PORT in .env`
      );
    }

    throw err;
  }
};

startServer().catch((err) => {
  console.error("❌ Failed to start backend:", err.message);
  process.exit(1);
});