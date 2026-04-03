import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AUTH_TOKEN_KEY, getMeetingMeta, getStreamToken } from "../lib/api";
import { useLiveTranscription } from "../hooks/useLiveTranscription";
import { getSocket } from "../services/socketService";
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  StreamTheme,
  CallControls,
  ParticipantView,
} from "@stream-io/video-react-sdk";
import { useCallStateHooks } from "@stream-io/video-react-bindings";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import "./CallPage.css";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;
const MAX_PARAGRAPH_LENGTH = 210;
const API_BASE = `${window.location.protocol}//${window.location.hostname}:5000/api`;

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const mapTranscriptEntryToBlock = (entry, language) => {
  const speaker = entry?.speaker || "Speaker";
  const text =
    language === "en"
      ? entry?.original || entry?.translated || ""
      : entry?.translated || entry?.original || "";

  return {
    speaker,
    text,
  };
};

const CallInner = ({
  call,
  handleLeave,
  subtitlesEnabled,
  onToggleTranscript,
  language,
  setLanguage,
  transcriptBlocks,
  setTranscriptBlocks,
  liveLine,
  liveSpeaker,
  setLiveLine,
  transcriptRef,
  speakerName,
  role,
  hostNameFromState,
  meetingSubject,
  meetingDateLabel,
  joinRequests,
  respondToJoinRequest,
}) => {
  const { useParticipants, useParticipantCount, useCallCreatedBy } =
    useCallStateHooks();
  const participants = useParticipants();
  const participantCount =
    useParticipantCount() || participants.length || 1;
  const createdBy = useCallCreatedBy();

  const hostName =
    hostNameFromState ||
    createdBy?.name ||
    createdBy?.id ||
    call?.state?.createdBy?.name ||
    call?.state?.createdBy?.id ||
    "Meeting Host";

  const subjectLabel = (meetingSubject || "General Discussion").trim();

  const participantInitials = participants
    .map((participant) => {
      const name = participant?.name || participant?.user?.name || participant?.userId || "U";
      return name.charAt(0).toUpperCase();
    })
    .slice(0, 5);

  const gridClass =
    participants.length <= 1
      ? "call-grid-one"
      : participants.length === 2
        ? "call-grid-two"
        : "call-grid-many";

  return (
    <div className="call-page-shell">
      <div className="call-top-panel">
        <div className="call-top-host">
          <span>Host: {hostName}</span>
          <span className="call-top-divider" aria-hidden="true">|</span>
          <span className="call-top-subject">Subject: {subjectLabel}</span>
        </div>
        <div className="call-top-count" title="Joined participants">
          <span className="participants-bubble-group">
            <span className="participants-main-bubble">
              {participantInitials.map((initial, index) => (
                <span key={`${initial}-${index}`} className={`participant-mini-bubble bubble-${index}`}>
                  {initial}
                </span>
              ))}
            </span>
          </span>
          <span>Participants</span>
          <strong>{participantCount}</strong>
        </div>
      </div>

      {role === "host" && joinRequests.length > 0 && (
        <div className="join-request-modal">
          <div className="join-request-title">Join request</div>
          <p>
            <strong>{joinRequests[0].requesterName}</strong> wants to join this meeting.
          </p>
          <div className="join-request-actions">
            <button
              className="decline-btn"
              onClick={() => respondToJoinRequest(joinRequests[0], false)}
            >
              Decline
            </button>
            <button
              className="accept-btn"
              onClick={() => respondToJoinRequest(joinRequests[0], true)}
            >
              Accept
            </button>
          </div>
        </div>
      )}

      <div
        className={`call-grid-wrap ${gridClass} ${subtitlesEnabled ? "transcript-open" : ""}`}
      >
        <div className={`call-grid ${gridClass}`}>
          {participants.map((participant) => {
            const tileKey =
              participant.sessionId ||
              participant.userId ||
              participant.user?.id;
            return (
              <div className="call-grid-tile" key={tileKey}>
                <ParticipantView participant={participant} />
              </div>
            );
          })}
        </div>
      </div>

      {subtitlesEnabled && (
        <div className="transcript-panel">
          <div className="transcript-header">
            <span>Live Transcript ({language.toUpperCase()})</span>
          </div>

          <div className="transcript-content" ref={transcriptRef}>
            {transcriptBlocks.map((block, i) => (
              <div key={`${block.speaker}-${i}`} className="transcript-row">
                <span className="speaker-chip">{block.speaker}:</span>
                <span>{block.text}</span>
              </div>
            ))}

            {liveLine && (
              <div className="transcript-row pending">
                <span className="speaker-chip">{liveSpeaker || speakerName}:</span>
                <span>{liveLine}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bottom-controls">
        <div className="bottom-controls-row">
          <CallControls onLeave={handleLeave} />

          <button
            onClick={onToggleTranscript}
            className="extra-control-btn"
          >
            {subtitlesEnabled
              ? "Hide Transcript"
              : "Show Transcript"}
          </button>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="language-select"
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="te">Telugu</option>
            <option value="ta">Tamil</option>
          </select>

          <button className="meeting-time-btn" type="button" title="Meeting date and time">
            {meetingDateLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const CallPage = () => {
  const { id: meetingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const sessionState = location.state || {};
  const canEnterMeeting = !!sessionState.approved;
  const role = sessionState.role || "guest";
  const hostNameFromState = role === "host" ? sessionState.displayName : sessionState.hostName;
  const meetingSubject = sessionState.meetingSubject || "General Discussion";
  const [userId] = useState(() => sessionState.userId || `guest-${Date.now().toString(36)}`);
  const [displayName] = useState(() => sessionState.displayName || "Guest");
  const preJoinVideoOn = sessionState.preJoinVideoOn !== false;
  const preJoinMicOn = sessionState.preJoinMicOn !== false;
  const authToken = sessionState.authToken || localStorage.getItem(AUTH_TOKEN_KEY);

  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [localStream, setLocalStream] = useState(null);

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [language, setLanguage] = useState("en");

  const [transcriptBlocks, setTranscriptBlocks] = useState([]);
  const [liveLine, setLiveLine] = useState("");
  const [liveSpeaker, setLiveSpeaker] = useState("");
  const [joinRequests, setJoinRequests] = useState([]);
  const [meetingMeta, setMeetingMeta] = useState(null);

  const transcriptRef = useRef(null);

  const loadTranscriptHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/transcript/${meetingId}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!res.ok) return;

      const data = await res.json();
      const transcriptList = data?.transcript || [];
      const mappedBlocks = transcriptList
        .map((entry) => mapTranscriptEntryToBlock(entry, language))
        .filter((entry) => entry.text?.trim());

      if (!mappedBlocks.length) return;

      setTranscriptBlocks((prev) => {
        const seen = new Set(prev.map((item) => `${item.speaker}|${item.text}`));
        const merged = [...prev];

        mappedBlocks.forEach((item) => {
          const key = `${item.speaker}|${item.text}`;
          if (!seen.has(key)) {
            merged.push(item);
            seen.add(key);
          }
        });

        return merged;
      });
    } catch (err) {
      console.error("Transcript history load warning:", err);
    }
  }, [meetingId, language, authToken]);

  const toggleTranscriptPanel = async () => {
    const next = !subtitlesEnabled;
    setSubtitlesEnabled(next);

    if (next) {
      await loadTranscriptHistory();
    }
  };

  useEffect(() => {
    if (!isJoined || !subtitlesEnabled) return;

    // Keep transcript panel synchronized for users who open it later.
    loadTranscriptHistory();

    const intervalId = setInterval(() => {
      loadTranscriptHistory();
    }, 1500);

    return () => clearInterval(intervalId);
  }, [isJoined, subtitlesEnabled, loadTranscriptHistory]);

  useEffect(() => {
    if (!canEnterMeeting || !authToken) {
      navigate("/", {
        replace: true,
        state: { redirectMeetingId: meetingId },
      });
    }
  }, [canEnterMeeting, authToken, navigate, meetingId]);

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken", userId],
    queryFn: getStreamToken,
    enabled: canEnterMeeting && !!authToken,
  });

  useEffect(() => {
    if (!canEnterMeeting) return;
    if (!tokenData?.token) return;

    let videoClient;
    let callInstance;
    let micStream;

    const applyInitialMediaState = async (activeCall) => {
      if (!activeCall) return;

      if (preJoinMicOn) {
        await activeCall.microphone.enable();
      } else {
        await activeCall.microphone.disable();
      }

      if (preJoinVideoOn) {
        await activeCall.camera.enable();
      } else {
        await activeCall.camera.disable();
      }
    };

    const initCall = async () => {
      const user = { id: userId, name: displayName };

      micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const micTrack = micStream.getAudioTracks()[0];
      if (micTrack) {
        micTrack.enabled = preJoinMicOn;
      }

      setLocalStream(micStream);

      videoClient = new StreamVideoClient({
        apiKey: STREAM_API_KEY,
        user,
        token: tokenData.token,
      });

      callInstance = videoClient.call("default", meetingId);

      await callInstance.join({
        create: true,
        withVideo: preJoinVideoOn,
        withAudio: preJoinMicOn,
      });

      await applyInitialMediaState(callInstance);

      setClient(videoClient);
      setCall(callInstance);
      setIsJoined(true);
    };

    initCall();

    return () => {
      setIsJoined(false);
      videoClient?.disconnectUser();
      micStream?.getTracks().forEach((t) => t.stop());
    };
  }, [canEnterMeeting, tokenData, meetingId, userId, displayName, preJoinVideoOn, preJoinMicOn]);

  useEffect(() => {
    if (!isJoined) return;
    loadTranscriptHistory();
  }, [isJoined]);

  useEffect(() => {
    if (!canEnterMeeting || role !== "host") return;

    const socket = getSocket(authToken);

    const handleJoinRequest = (payload) => {
      setJoinRequests((prev) => [...prev, payload]);
    };

    socket.emit("register-host", {
      meetingId,
      hostId: userId,
      hostName: displayName,
      meetingSubject,
    });

    socket.on("join-request", handleJoinRequest);

    return () => {
      socket.off("join-request", handleJoinRequest);
    };
  }, [canEnterMeeting, role, meetingId, userId, displayName, authToken, meetingSubject]);

  useEffect(() => {
    if (!canEnterMeeting || !authToken) return;

    let cancelled = false;

    const loadMeetingMeta = async () => {
      try {
        const data = await getMeetingMeta(meetingId);
        if (!cancelled) {
          setMeetingMeta(data);
        }
      } catch (err) {
        console.error("Meeting metadata load warning:", err.message);
      }
    };

    loadMeetingMeta();

    return () => {
      cancelled = true;
    };
  }, [canEnterMeeting, authToken, meetingId]);

  useLiveTranscription({
    enabled: isJoined && !!localStream,
    stream: localStream,
    language,
    authToken,
    meetingId,
    speakerId: userId,
    displayName,
    role,
    onText: ({ text, final, speaker }) => {
      if (!text?.trim()) return;
      const normalizedSpeaker = speaker || "Speaker";

      if (final) {
        setTranscriptBlocks((prev) => {
          if (prev.length === 0) {
            return [{ speaker: normalizedSpeaker, text }];
          }

          const updated = [...prev];
          const lastBlock = updated[updated.length - 1];

          if (
            lastBlock.speaker !== normalizedSpeaker ||
            lastBlock.text.length + text.length + 1 >
            MAX_PARAGRAPH_LENGTH
          ) {
            updated.push({ speaker: normalizedSpeaker, text });
          } else {
            lastBlock.text += ` ${text}`;
          }

          return updated;
        });

        setLiveLine("");
        setLiveSpeaker("");
      } else {
        setLiveLine(text);
        setLiveSpeaker(normalizedSpeaker);
      }
    },
  });

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop =
        transcriptRef.current.scrollHeight;
    }
  }, [transcriptBlocks, liveLine]);

  const handleLeave = async () => {
    try {
      if (call) {
        await call.leave();
      }
    } catch {
      console.log("Call already left");
    }

    // 🔥 Trigger automatic transcript modification using Gemini
    try {
      const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const transcriptRes = await fetch(`${API_BASE}/transcript/${meetingId}`, {
        headers: authHeaders,
      });
      let transcriptList = [];

      if (transcriptRes.ok) {
        const transcriptPayload = await transcriptRes.json();
        transcriptList = transcriptPayload?.transcript || [];
      }

      if (!transcriptList.length) {
        console.log("ℹ️ No transcript entries found. Skipping transcript modification.");
      } else {
        const modifyRes = await fetch(`${API_BASE}/transcript/${meetingId}/modify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
        });

        let modifyPayload = null;
        try {
          modifyPayload = await modifyRes.json();
        } catch {
          modifyPayload = null;
        }

        if (modifyRes.ok) {
          console.log("✅ Transcript modification response:", modifyPayload || { status: "ok" });
        } else {
          console.log("⚠️ Transcript modification skipped:", modifyPayload || { status: modifyRes.status });
        }
      }
    } catch (err) {
      console.log("⚠️ Could not trigger transcript modification:", err.message);
      // Continue to summary page even if modification fails
    }

    navigate(`/summary/${meetingId}`);
  };

  const respondToJoinRequest = (request, accepted) => {
    const socket = getSocket(authToken);
    socket.emit("respond-join-request", {
      requestId: request.requestId,
      accepted,
    });

    setJoinRequests((prev) => prev.filter((item) => item.requestId !== request.requestId));
  };

  if (!canEnterMeeting || !authToken) {
    return null;
  }

  if (!client || !call || !isJoined) {
    return <p style={{ padding: 20 }}>Joining meeting...</p>;
  }

  const meetingDateLabel = `Meeting: ${formatDateTime(meetingMeta?.startedAt)}`;

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <StreamTheme>
          <CallInner
            call={call}
            handleLeave={handleLeave}
            subtitlesEnabled={subtitlesEnabled}
            onToggleTranscript={toggleTranscriptPanel}
            language={language}
            setLanguage={setLanguage}
            transcriptBlocks={transcriptBlocks}
            setTranscriptBlocks={setTranscriptBlocks}
            liveLine={liveLine}
            liveSpeaker={liveSpeaker}
            setLiveLine={setLiveLine}
            transcriptRef={transcriptRef}
            speakerName={displayName}
            role={role}
            hostNameFromState={hostNameFromState}
            meetingSubject={meetingSubject}
            meetingDateLabel={meetingDateLabel}
            joinRequests={joinRequests}
            respondToJoinRequest={respondToJoinRequest}
          />
        </StreamTheme>
      </StreamCall>
    </StreamVideo>
  );
};

export default CallPage;
