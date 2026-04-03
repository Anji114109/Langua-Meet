import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

export const useLiveTranscription = ({
  enabled,
  stream,
  language,
  authToken,
  meetingId,      // 🔥 NEW
  speakerId,      // 🔥 NEW
  displayName,
  role,
  onText,
}) => {
  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);

  // START / STOP
  useEffect(() => {
    if (!enabled || !stream || !meetingId || !speakerId || !authToken) {
      stop();
      return;
    }

    start();
    return () => stop();
  }, [enabled, stream, meetingId, speakerId, authToken]);

  // LANGUAGE UPDATE
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected && language) {
      socketRef.current.emit("set-language", language);
    }
  }, [language]);

  const start = async () => {
    if (socketRef.current) return;

    socketRef.current = io(
      `${window.location.protocol}//${window.location.hostname}:5000`,
      {
      transports: ["websocket"],
      auth: {
        token: authToken,
      },
    });

    socketRef.current.on("connect", () => {
      console.log("🔌 Connected to backend");

      // 🔥 JOIN MEETING (CRITICAL)
      socketRef.current.emit("join-meeting", {
        meeting_id: meetingId,
        speaker_id: speakerId,
        display_name: displayName || speakerId,
        role: role || "guest",
      });

      // 🔥 Send initial language
      if (language) {
        socketRef.current.emit("set-language", language);
      }
    });

    socketRef.current.on("subtitle", (data) => {
      if (!data?.text) return;

      onText({
        text: data.text,
        final: !!data.final,
        speaker: data.speaker || "Speaker",
      });
    });

    // 🎙 AUDIO PROCESSING
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    const audioContext = new AudioContext({
      sampleRate: 16000,
    });

    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    sourceRef.current = source;

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
      if (!socketRef.current) return;
      if (socketRef.current.disconnected) return;

      const input = e.inputBuffer.getChannelData(0);
      const float32 = new Float32Array(input.length);
      float32.set(input);

      socketRef.current.emit("audio-chunk", float32.buffer);
    };
  };

  const stop = async () => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (
      audioContextRef.current &&
      audioContextRef.current.state !== "closed"
    ) {
      await audioContextRef.current.close();
    }

    audioContextRef.current = null;
    processorRef.current = null;
    sourceRef.current = null;
  };
};