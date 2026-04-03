import WebSocket from "ws";

const whisperConnections = new Map();

/*
  whisperConnections = {
    connectionId: {
        meetingId: string,
        socket: WebSocket,
        isConnecting: boolean
    }
  }
*/

export const connectToWhisper = ({ connectionId, meetingId, speakerId, displayName }) => {
  if (!connectionId || !meetingId) return null;

  if (whisperConnections.has(connectionId)) {
    const existing = whisperConnections.get(connectionId);
    if (existing.socket.readyState === WebSocket.OPEN) {
      return existing.socket;
    }
  }

  console.log(`🔌 Connecting to ASR for meeting ${meetingId} (${connectionId})`);

  const socket = new WebSocket("ws://127.0.0.1:8000/ws");

  whisperConnections.set(connectionId, {
    meetingId,
    socket,
    isConnecting: true,
  });

  socket.on("open", () => {
    console.log("🧠 Connected to ASR Service");

    const entry = whisperConnections.get(connectionId);
    if (entry) {
      entry.isConnecting = false;
    }

    socket.send(
      JSON.stringify({
        type: "init",
        meeting_id: meetingId,
        speaker_id: speakerId || connectionId,
        display_name: displayName || speakerId || "Guest",
      })
    );
  });

  socket.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (!parsed?.text) return;

      if (global.io) {
        global.io.to(meetingId).emit("subtitle", parsed);
      }

    } catch (err) {
      console.error("❌ Parse error:", err.message);
    }
  });

  socket.on("close", () => {
    console.log(`⚠ ASR disconnected for meeting ${meetingId} (${connectionId})`);
    whisperConnections.delete(connectionId);
  });

  socket.on("error", (err) => {
    console.error("🔥 ASR socket error:", err.message);
  });

  return socket;
};

export const sendAudioChunk = (connectionId, chunk) => {
  const conn = whisperConnections.get(connectionId);
  if (!conn) return;

  if (conn.socket.readyState !== WebSocket.OPEN) return;

  conn.socket.send(Buffer.from(chunk));
};

export const sendLanguageUpdate = (connectionId, lang) => {
  const conn = whisperConnections.get(connectionId);
  if (!conn) return;

  if (conn.socket.readyState !== WebSocket.OPEN) return;

  conn.socket.send(
    JSON.stringify({
      type: "set-language",
      lang,
    })
  );
};

export const closeWhisperConnection = (connectionId) => {
  const conn = whisperConnections.get(connectionId);
  if (!conn) return;

  if (
    conn.socket.readyState === WebSocket.OPEN ||
    conn.socket.readyState === WebSocket.CONNECTING
  ) {
    conn.socket.close();
  }

  whisperConnections.delete(connectionId);
};