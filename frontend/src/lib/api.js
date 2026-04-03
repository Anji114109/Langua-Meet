const API_BASE = `${window.location.protocol}//${window.location.hostname}:5000/api`;

export const AUTH_TOKEN_KEY = "techmeet_auth_token";

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY);

const authHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const googleAuth = async (credential) => {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });

  if (!res.ok) {
    throw new Error("Google authentication failed");
  }

  return res.json();
};

export const firebaseAuth = async (idToken) => {
  const res = await fetch(`${API_BASE}/auth/firebase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    let message = "Firebase authentication failed";
    try {
      const errorBody = await res.json();
      if (errorBody?.error) {
        message = errorBody.error;
      }
    } catch {
      // Keep default message when response is not JSON.
    }

    throw new Error(message);
  }

  return res.json();
};

export const getMe = async () => {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      ...authHeaders(),
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch user profile");
  }

  return res.json();
};

export const getStreamToken = async ({ queryKey }) => {
  const [, userId] = queryKey;

  const res = await fetch(`${API_BASE}/stream/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch Stream token");
  }

  return res.json();
};

export const getMeetingHistory = async (type) => {
  const res = await fetch(`${API_BASE}/history/meetings/${type}`, {
    headers: {
      ...authHeaders(),
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch meeting history");
  }

  return res.json();
};

export const getSummaryHistory = async () => {
  const res = await fetch(`${API_BASE}/history/summaries`, {
    headers: {
      ...authHeaders(),
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch summary history");
  }

  return res.json();
};

export const getMeetingMeta = async (meetingId) => {
  const res = await fetch(`${API_BASE}/history/meetings/${meetingId}/meta`, {
    headers: {
      ...authHeaders(),
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch meeting metadata");
  }

  return res.json();
};

export const triggerTranscriptModify = async (meetingId) => {
  const res = await fetch(`${API_BASE}/transcript/${meetingId}/modify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  return { ok: res.ok, status: res.status, payload };
};

/* 🔥 Gemini Correction Function */
export const correctTranscript = async (text) => {
  const res = await fetch(`${API_BASE}/gemini/correct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error("Failed to correct transcript");
  }

  const data = await res.json();
  return data.correctedText;
};
