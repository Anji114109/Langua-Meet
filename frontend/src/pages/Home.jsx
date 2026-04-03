import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSocket } from "../services/socketService";
import {
  AUTH_TOKEN_KEY,
  firebaseAuth,
  getMeetingHistory,
  getSummaryHistory,
  getMe,
} from "../lib/api";
import { useFirebase } from "../context/Firebase";
import AccountMenu from "../components/AccountMenu";
import GradientText from "../components/GradientText";
import "./Home.css";

const generateMeetingId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;

const ensureUserId = () => {
  const existing = localStorage.getItem("meeting_user_id");
  if (existing) return existing;

  const newId = `user-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  localStorage.setItem("meeting_user_id", newId);
  return newId;
};

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const formatDuration = (value) => {
  if (value === null || value === undefined) return "-";

  const total = Math.max(0, Number(value) || 0);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }

  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }

  return `${secs}s`;
};

const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: firebaseUser, signinWithGoogle, logout: firebaseLogout } = useFirebase();

  const [meetingId, setMeetingId] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [mediaStream, setMediaStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCheckingMedia, setIsCheckingMedia] = useState(false);

  const [isRequestingJoin, setIsRequestingJoin] = useState(false);
  const [joinStatusMessage, setJoinStatusMessage] = useState("");
  const [showSubjectPrompt, setShowSubjectPrompt] = useState(false);
  const [meetingSubject, setMeetingSubject] = useState("");
  const [isHistoryMenuOpen, setIsHistoryMenuOpen] = useState(false);
  const [detailPanelView, setDetailPanelView] = useState("");
  const [memberMeetings, setMemberMeetings] = useState([]);
  const [hostMeetings, setHostMeetings] = useState([]);
  const [summaryItems, setSummaryItems] = useState([]);
  const [summaryLanguageMap, setSummaryLanguageMap] = useState({});
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [activeDownloadMeetingId, setActiveDownloadMeetingId] = useState("");

  const previewRef = useRef(null);

  const features = [
    {
      id: 1,
      title: "Crystal Clear Meetings, Anytime",
      description: "Experience ultra-smooth, high-definition video calls with low latency and real-time stability.",
      icon: "🎥",
      image: "/images/first.png",
      position: "top",
    },
    {
      id: 2,
      title: "Turn Speech into Text Instantly",
      description: "Capture every word accurately with real-time AI-powered transcription.",
      icon: "🎤",
      image: "/images/second.png",
      position: "right-top",
    },
    {
      id: 3,
      title: "Speak Any Language, Understand Every Word",
      description: "Break language barriers with instant translation during live meetings.",
      icon: "🌍",
      image: "/images/third.png",
      position: "right-bottom",
    },
    {
      id: 4,
      title: "Automatic Meeting Summaries, Ready in Seconds",
      description: "Get concise, structured summaries in multiple languages after every meeting.",
      icon: "📋",
      image: "/images/fourth.png",
      position: "bottom",
    },
    {
      id: 5,
      title: "Smarter Insights with AI Enhancement",
      description: "Refine and enhance summaries using advanced AI for better clarity and understanding.",
      icon: "✨",
      image: "/images/fifth.png",
      position: "left-bottom",
    },
  ];

  useEffect(() => {
    const bootstrapAuth = async () => {
      const existingToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!existingToken) {
        setIsAuthLoading(false);
        return;
      }

      try {
        const data = await getMe();
        setAuthUser(data.user);
      } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      } finally {
        setIsAuthLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  useEffect(() => {
    const redirectMeetingId = location.state?.redirectMeetingId;
    if (redirectMeetingId) {
      setMeetingId(redirectMeetingId);
      setJoinStatusMessage("Please check camera and mic, then ask to join.");
      navigate("/", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mediaStream]);

  useEffect(() => {
    if (previewRef.current && mediaStream) {
      previewRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  useEffect(() => {
    let cancelled = false;

    const syncFirebaseSession = async () => {
      if (!firebaseUser) {
        setIsAuthLoading(false);
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        const data = await firebaseAuth(idToken);
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);

        if (!cancelled) {
          setAuthUser(data.user);
        }
      } catch (error) {
        if (!cancelled) {
          setJoinStatusMessage(error?.message || "Google login failed. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsAuthLoading(false);
        }
      }
    };

    syncFirebaseSession();

    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  const handleGoogleSignIn = async () => {
    try {
      setJoinStatusMessage("");
      await signinWithGoogle();
    } catch {
      setJoinStatusMessage("Google login failed. Please try again.");
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await firebaseLogout();
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setAuthUser(null);
      setJoinStatusMessage("Signed out successfully.");
    }
  };

  const checkCameraAndMic = async () => {
    if (!authUser) {
      setJoinStatusMessage("Please sign in with Google first.");
      return;
    }

    setIsCheckingMedia(true);
    setJoinStatusMessage("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

      setMediaStream(stream);
      setCameraReady(stream.getVideoTracks().length > 0);
      setMicReady(stream.getAudioTracks().length > 0);
      setIsCameraOn(true);
      setIsMicOn(true);
      setJoinStatusMessage("Camera and microphone are ready.");
    } catch {
      setCameraReady(false);
      setMicReady(false);
      setJoinStatusMessage(
        "Unable to access camera or microphone. Please allow permissions and try again."
      );
    } finally {
      setIsCheckingMedia(false);
    }
  };

  const toggleCamera = () => {
    if (!mediaStream) {
      setJoinStatusMessage("Please check camera and mic first.");
      return;
    }

    const track = mediaStream.getVideoTracks()[0];
    if (!track) {
      setJoinStatusMessage("No camera track found.");
      return;
    }

    track.enabled = !track.enabled;
    setIsCameraOn(track.enabled);
  };

  const toggleMic = () => {
    if (!mediaStream) {
      setJoinStatusMessage("Please check camera and mic first.");
      return;
    }

    const track = mediaStream.getAudioTracks()[0];
    if (!track) {
      setJoinStatusMessage("No microphone track found.");
      return;
    }

    track.enabled = !track.enabled;
    setIsMicOn(track.enabled);
  };

  const createMeeting = () => {
    if (!authUser) {
      setJoinStatusMessage("Please sign in with Google first.");
      return;
    }

    if (!cameraReady || !micReady) {
      setJoinStatusMessage("Please check camera and mic before creating a meeting.");
      return;
    }

    setShowSubjectPrompt(true);
  };

  const confirmCreateMeeting = () => {
    const subject = meetingSubject.trim();
    if (!subject) {
      setJoinStatusMessage("Please enter meeting subject.");
      return;
    }

    const id = generateMeetingId();
    const fallbackId = ensureUserId();

    const displayName = authUser.fullName || authUser.username || "Host";

    navigate(`/meeting/${id}`, {
      state: {
        approved: true,
        role: "host",
        userId: authUser.id || fallbackId,
        displayName,
        authToken: localStorage.getItem(AUTH_TOKEN_KEY),
        mediaChecked: true,
        preJoinVideoOn: isCameraOn,
        preJoinMicOn: isMicOn,
        meetingSubject: subject,
      },
    });

    setShowSubjectPrompt(false);
    setMeetingSubject("");
  };

  const askToJoin = () => {
    if (!authUser) {
      setJoinStatusMessage("Please sign in with Google first.");
      return;
    }

    const meetingIdValue = meetingId.trim();
    if (!meetingIdValue) {
      setJoinStatusMessage("Please enter a meeting ID.");
      return;
    }

    if (!cameraReady || !micReady) {
      setJoinStatusMessage("Please check camera and mic before asking to join.");
      return;
    }

    const requesterId = authUser.id || ensureUserId();
    const displayName = authUser.fullName || authUser.username || "Guest";
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    setIsRequestingJoin(true);
    setJoinStatusMessage("Waiting for host approval...");

    const socket = getSocket(token);

    socket.emit("request-join", {
      meetingId: meetingIdValue,
      requesterId,
      requesterName: displayName,
    });

    socket.once("join-response", (payload) => {
      if (payload?.accepted) {
        setJoinStatusMessage("Request accepted. Joining meeting...");

        navigate(`/meeting/${meetingIdValue}`, {
          state: {
            approved: true,
            role: "guest",
            userId: requesterId,
            displayName,
            hostName: payload?.hostName || "Host",
            meetingSubject: payload?.meetingSubject || "General Discussion",
            authToken: token,
            mediaChecked: true,
            preJoinVideoOn: isCameraOn,
            preJoinMicOn: isMicOn,
          },
        });
      } else {
        setJoinStatusMessage(payload?.reason || "Host declined your request.");
      }

      setIsRequestingJoin(false);
    });
  };

  const openMenuRoot = () => {
    setPanelError("");
    setIsHistoryMenuOpen(true);
    setDetailPanelView("");
  };

  const closeHistoryMenu = () => {
    setIsHistoryMenuOpen(false);
    setDetailPanelView("");
    setPanelError("");
  };

  const closeDetailPanel = () => {
    setDetailPanelView("");
    setPanelError("");
  };

  const openMeetings = async () => {
    setDetailPanelView("meetings");
    setPanelLoading(true);
    setPanelError("");

    try {
      const [memberData, hostData] = await Promise.all([
        getMeetingHistory("member"),
        getMeetingHistory("host"),
      ]);
      setMemberMeetings(memberData?.meetings || []);
      setHostMeetings(hostData?.meetings || []);
    } catch {
      setPanelError("Unable to load meetings history.");
    } finally {
      setPanelLoading(false);
    }
  };

  const openSummaries = async () => {
    setDetailPanelView("summaries");
    setPanelLoading(true);
    setPanelError("");

    try {
      const data = await getSummaryHistory();
      const summaries = data?.summaries || [];
      setSummaryItems(summaries);

      const nextLanguageMap = {};
      summaries.forEach((item) => {
        nextLanguageMap[item.meetingId] = item.language || "en";
      });
      setSummaryLanguageMap(nextLanguageMap);
    } catch {
      setPanelError("Unable to load summaries history.");
    } finally {
      setPanelLoading(false);
    }
  };

  const getSummaryRole = (summary) => {
    const currentUserName = (authUser?.fullName || authUser?.username || "").trim().toLowerCase();
    const summaryHostName = (summary?.host || "").trim().toLowerCase();
    return currentUserName && summaryHostName === currentUserName ? "host" : "member";
  };

  const downloadSummaryFromPanel = async (item) => {
    const meetingIdValue = item?.meetingId;
    if (!meetingIdValue) return;

    const lang = summaryLanguageMap[meetingIdValue] || item.language || "en";
    setActiveDownloadMeetingId(meetingIdValue);
    setPanelError("");

    try {
      // Summary panel already represents persisted summaries. PDF route now
      // applies Gemini polish + translation fallback from stored summary text.
      console.log("Summary panel download using stored summary fallback path");

      const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
      const pdfRes = await fetch(`${window.location.protocol}//${window.location.hostname}:5000/api/pdf/${meetingIdValue}?lang=${lang}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!pdfRes.ok) {
        throw new Error("PDF generation failed");
      }

      const blob = await pdfRes.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `meeting-${meetingIdValue}-${lang}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setPanelError("Unable to download summary PDF right now.");
    } finally {
      setActiveDownloadMeetingId("");
    }
  };

  const renderPrimaryHistoryPanel = () => {
    return (
      <div className="history-option-list">
        <button className="history-option-btn" onClick={openMeetings}>
          <span className="history-option-icon" aria-hidden="true">📅</span>
          <span>Meetings</span>
        </button>
        <button className="history-option-btn" onClick={openSummaries}>
          <span className="history-option-icon" aria-hidden="true">📝</span>
          <span>Summaries</span>
        </button>
      </div>
    );
  };

  const renderDetailHistoryPanel = () => {
    if (panelLoading) {
      return <div className="history-panel-status">Loading...</div>;
    }

    if (panelError) {
      return <div className="history-panel-status error">{panelError}</div>;
    }

    if (detailPanelView === "meetings") {
      const meetingCards = [
        ...hostMeetings.map((meeting) => ({ ...meeting, role: "host" })),
        ...memberMeetings.map((meeting) => ({ ...meeting, role: "member" })),
      ].sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());

      if (!meetingCards.length) {
        return <div className="history-panel-status">No meetings found.</div>;
      }

      return (
        <div className="history-card-list">
          {meetingCards.map((meeting) => (
            <div key={`${meeting.role}-${meeting.meetingId}`} className={`history-data-card ${meeting.role === "host" ? "role-host" : "role-member"}`}>
              <div><strong>Role:</strong> {meeting.role === "host" ? "Host" : "Member"}</div>
              <div><strong>Host:</strong> {meeting.host}</div>
              <div><strong>Subject:</strong> {meeting.subject}</div>
              <div><strong>No. of participants:</strong> {meeting.participantCount ?? "-"}</div>

              {meeting.role === "host" && (
                <>
                  <div><strong>Participants:</strong></div>
                  <div className="history-participants-list">
                    {(meeting.participants || []).length ? (
                      meeting.participants.map((participant) => (
                        <div key={`${meeting.meetingId}-${participant.userId}`} className="history-participant-row">
                          <span>{participant.fullName}</span>
                          <span>{participant.email}</span>
                        </div>
                      ))
                    ) : (
                      <div className="history-panel-status">No participant details available.</div>
                    )}
                  </div>
                </>
              )}

              <div><strong>Time and date:</strong> {formatDateTime(meeting.startedAt)}</div>
              <div><strong>Duration:</strong> {formatDuration(meeting.durationSeconds)}</div>
            </div>
          ))}
        </div>
      );
    }

    if (detailPanelView !== "summaries") {
      return <div className="history-panel-status">Select a section to view details.</div>;
    }

    if (!summaryItems.length) {
      return <div className="history-panel-status">No summaries available.</div>;
    }

    return (
      <div className="history-card-list">
        {summaryItems.map((summary) => {
          const selectedLanguage = summaryLanguageMap[summary.meetingId] || summary.language || "en";
          const isDownloading = activeDownloadMeetingId === summary.meetingId;
          const summaryRole = getSummaryRole(summary);

          return (
            <div
              key={`${summary.meetingId}-${summary.language}-${summary.generatedAt}`}
              className={`history-data-card ${summaryRole === "host" ? "role-host" : "role-member"}`}
            >
              <div><strong>Role:</strong> {summaryRole === "host" ? "Host" : "Member"}</div>
              <div><strong>Host:</strong> {summary.host}</div>
              <div><strong>Subject:</strong> {summary.subject}</div>
              <div><strong>Time and date:</strong> {formatDateTime(summary.startedAt)}</div>
              <div><strong>Duration:</strong> {formatDuration(summary.durationSeconds)}</div>

              <div className="summary-panel-actions">
                <select
                  value={selectedLanguage}
                  onChange={(e) => {
                    const nextLang = e.target.value;
                    setSummaryLanguageMap((prev) => ({
                      ...prev,
                      [summary.meetingId]: nextLang,
                    }));
                  }}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="te">Telugu</option>
                  <option value="ta">Tamil</option>
                </select>

                <button
                  className="history-option-btn download-btn"
                  onClick={() => downloadSummaryFromPanel(summary)}
                  disabled={isDownloading}
                >
                  {isDownloading ? "Preparing PDF..." : "Download PDF"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="home-shell">
      {/* Landing Page (Before Login) */}
      {!authUser && isAuthLoading === false && (
        <div className="landing-page">
          <div className="landing-container">
            {/* Hero Section */}
            <div className="hero-center">
              <h1 className="hero-title">
                <GradientText
                  colors={["#8fa7ff", "#e0b8ff", "#8bcfff"]}
                  animationSpeed={1}
                  showBorder={false}
                  pauseOnHover
                >
                  LINGUA MEET
                </GradientText>
              </h1>
              <p className="hero-subtitle">AI based - Real Time Meetings and Summarizer</p>

              <div className="hero-logo-wrapper">
                <img
                  src="/images/logo main2.png"
                  alt="LinguaMeet Logo"
                  className="hero-logo"
                  onError={(e) => {
                    console.warn("Logo image not found at /public/images/logo main2.png");
                  }}
                />
              </div>

              <div className="hero-action-row">
                <button className="google-signin-btn-large" onClick={handleGoogleSignIn}>
                  <span className="google-mark" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21.805 10.023H12v3.955h5.636c-.243 1.272-.972 2.35-2.067 3.074v2.55h3.338c1.954-1.8 3.074-4.451 3.074-7.602 0-.667-.06-1.308-.176-1.977z" fill="#4285F4"/>
                      <path d="M12 22c2.79 0 5.129-.924 6.838-2.5l-3.338-2.55c-.923.62-2.102.99-3.5.99-2.689 0-4.964-1.814-5.778-4.253H2.77v2.629A9.997 9.997 0 0012 22z" fill="#34A853"/>
                      <path d="M6.222 13.687A5.999 5.999 0 015.9 12c0-.586.1-1.155.322-1.687V7.684H2.77A9.997 9.997 0 002 12c0 1.612.384 3.136 1.07 4.316l3.152-2.629z" fill="#FBBC05"/>
                      <path d="M12 6.06c1.517 0 2.88.522 3.951 1.547l2.959-2.959C17.124 2.983 14.786 2 12 2A9.997 9.997 0 002.77 7.684l3.452 2.629C7.036 7.874 9.311 6.06 12 6.06z" fill="#EA4335"/>
                    </svg>
                  </span>
                  <span>Login</span>
                </button>
              </div>

              <div className="lanyard-stage" aria-label="LinguaMeet feature cards">
                {features.map((feature, index) => (
                  <div key={feature.id} className={`lanyard-item lanyard-item-${index + 1}`}>
                    <div className="lanyard-string" aria-hidden="true" />
                    <div className="feature-card lanyard-card">
                      <div className="feature-icon">
                        <img
                          src={feature.image}
                          alt={feature.title}
                          className="feature-image"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      </div>
                      <h3 className="feature-title">{feature.title}</h3>
                      <p className="feature-desc">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard/Post-Login Interface */}
      {authUser && (
        <>
          <div className="home-topbar">
            <div className="topbar-left">
              <button
                type="button"
                className="history-menu-toggle"
                onClick={openMenuRoot}
                aria-label="Open history menu"
              >
                <span />
                <span />
                <span />
              </button>
            </div>

            <div className="topbar-right">
              <AccountMenu
                user={authUser}
                onLogout={handleGoogleSignOut}
              />
            </div>
          </div>

          {isHistoryMenuOpen && (
            <div className="history-panel-wrap" role="dialog" aria-modal="true">
              <div className="history-panel-stack">
                <div className="history-panel-glass primary-panel">
                  <div className="history-panel-header">
                    <button type="button" className="history-back-btn" onClick={closeHistoryMenu}>
                      ×
                    </button>
                  </div>

                  <div className="history-panel-content-switch">
                    {renderPrimaryHistoryPanel()}
                  </div>
                </div>

                {detailPanelView && (
                  <div className="history-panel-glass detail-panel">
                    <div className="history-panel-header detail-header">
                      <div className="history-detail-title-wrap">
                        <h4>{detailPanelView === "meetings" ? "Meetings" : "Summaries"}</h4>
                        <div className="history-role-legend" aria-label="Role color legend">
                          <span className="legend-chip host">Host</span>
                          <span className="legend-chip member">Member</span>
                        </div>
                      </div>

                      <button type="button" className="history-back-btn" onClick={closeDetailPanel}>
                        ←
                      </button>
                    </div>

                    <div key={detailPanelView} className="history-panel-content-switch">
                      {renderDetailHistoryPanel()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="home-main-content">
            <div className="home-hero">
              <h1>
                <GradientText
                  colors={["#8fa7ff", "#e0b8ff", "#8bcfff"]}
                  animationSpeed={1}
                  showBorder={false}
                >
                  LinguaMeet
                </GradientText>
              </h1>
              <p>Professional video meetings with live multilingual transcripts.</p>
            </div>

            <div className="prejoin-card">
              <div className="preview-box">
              {mediaStream ? (
                <video
                  ref={previewRef}
                  autoPlay
                  muted
                  playsInline
                  className="preview-video"
                />
              ) : (
                <div className="preview-placeholder">
                  Camera preview will appear here
                </div>
              )}

                <div className="preview-media-overlay">
                <button
                  type="button"
                  className={`preview-icon-btn ${isCameraOn ? "active" : "muted"}`}
                  onClick={toggleCamera}
                  disabled={!authUser || !mediaStream}
                  title={isCameraOn ? "Turn camera off" : "Turn camera on"}
                >
                  {isCameraOn ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="2"/>
                      <path d="M17 10l5-3v10l-5-3v-4z" fill="currentColor"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="2"/>
                      <path d="M17 10l5-3v10l-5-3v-4z" fill="currentColor"/>
                      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  className={`preview-icon-btn ${isMicOn ? "active" : "muted"}`}
                  onClick={toggleMic}
                  disabled={!authUser || !mediaStream}
                  title={isMicOn ? "Turn microphone off" : "Turn microphone on"}
                >
                  {isMicOn ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="8" y="3" width="8" height="12" rx="4" stroke="currentColor" strokeWidth="2"/>
                      <path d="M5 11v1a7 7 0 0 0 14 0v-1" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 19v3" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="8" y="3" width="8" height="12" rx="4" stroke="currentColor" strokeWidth="2"/>
                      <path d="M5 11v1a7 7 0 0 0 14 0v-1" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 19v3" stroke="currentColor" strokeWidth="2"/>
                      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  )}
                </button>
                </div>
              </div>

              <div className="prejoin-fields">
              <label>Full name</label>
              <input value={authUser?.fullName || ""} readOnly />

              <label htmlFor="meeting-id">Meeting ID</label>
              <input
                id="meeting-id"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                placeholder="Paste meeting ID"
              />

              <div className="device-status-row">
                <span className={cameraReady ? "ready" : "not-ready"}>
                  Camera {cameraReady ? "Ready" : "Not ready"}
                </span>
                <span className={micReady ? "ready" : "not-ready"}>
                  Microphone {micReady ? "Ready" : "Not ready"}
                </span>
              </div>

              <div className="home-actions">
                <button
                  className="primary"
                  onClick={checkCameraAndMic}
                  disabled={isCheckingMedia || !authUser}
                >
                  {isCheckingMedia ? "Checking..." : "Check camera & mic"}
                </button>

                <button onClick={createMeeting} disabled={!authUser}>Create Meeting</button>

                <button onClick={askToJoin} disabled={isRequestingJoin || !authUser}>
                  {isRequestingJoin ? "Requesting..." : "Ask to Join"}
                </button>
              </div>

                {joinStatusMessage && (
                  <div className="join-status" role="status" aria-live="polite">
                    {joinStatusMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showSubjectPrompt && (
        <div className="subject-modal-backdrop" role="dialog" aria-modal="true">
          <div className="subject-modal-card">
            <h3>Meeting Subject</h3>
            <p>Set a clear subject so participants understand the meeting context.</p>
            <input
              value={meetingSubject}
              onChange={(e) => setMeetingSubject(e.target.value)}
              placeholder="Enter meeting subject"
              maxLength={80}
              autoFocus
            />

            <div className="subject-modal-actions">
              <button
                type="button"
                onClick={() => {
                  setShowSubjectPrompt(false);
                  setMeetingSubject("");
                }}
              >
                Cancel
              </button>
              <button type="button" className="primary" onClick={confirmCreateMeeting}>
                Continue to Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
