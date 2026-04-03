import {
  meetingsCollection,
  meetingParticipantsCollection,
  meetingSummariesCollection,
} from "../db/collections.js";

export const ensureMeetingForHost = async ({ meetingId, hostId, hostName, subject }) => {
  if (!meetingId || !hostId) return;

  const existingMeeting = await meetingsCollection().findOne(
    { meeting_id: meetingId },
    { projection: { _id: 0, host_user_id: 1 } }
  );

  if (existingMeeting?.host_user_id && existingMeeting.host_user_id !== hostId) {
    const err = new Error("Meeting is already owned by another host");
    err.code = "MEETING_HOST_CONFLICT";
    throw err;
  }

  const now = new Date();

  await meetingsCollection().updateOne(
    { meeting_id: meetingId },
    {
      $set: {
        host_user_id: hostId,
        host_name: hostName || "Host",
        subject: subject || "General Discussion",
        status: "active",
        updated_at: now,
      },
      $setOnInsert: {
        meeting_id: meetingId,
        created_at: now,
        started_at: now,
      },
      $unset: {
        ended_at: "",
        duration_seconds: "",
      },
    },
    { upsert: true }
  );
};

export const hasMeetingAccess = async ({ meetingId, userId }) => {
  if (!meetingId || !userId) return false;

  const membership = await meetingParticipantsCollection().findOne(
    { meeting_id: meetingId, user_id: userId },
    { projection: { _id: 1 } }
  );

  if (membership) return true;

  const hostedMeeting = await meetingsCollection().findOne(
    { meeting_id: meetingId, host_user_id: userId },
    { projection: { _id: 1 } }
  );

  return !!hostedMeeting;
};

export const upsertMeetingParticipant = async ({
  meetingId,
  userId,
  displayName,
  role,
  socketId,
}) => {
  if (!meetingId || !userId) return;

  await meetingParticipantsCollection().updateOne(
    { meeting_id: meetingId, user_id: userId },
    {
      $set: {
        display_name: displayName || "Guest",
        role: role || "guest",
        socket_id: socketId || null,
        joined_at: new Date(),
        left_at: null,
      },
      $setOnInsert: {
        created_at: new Date(),
      },
    },
    { upsert: true }
  );
};

export const markParticipantLeft = async ({ meetingId, socketId }) => {
  if (!meetingId || !socketId) return;

  await meetingParticipantsCollection().updateMany(
    { meeting_id: meetingId, socket_id: socketId, left_at: null },
    {
      $set: {
        left_at: new Date(),
      },
    }
  );

  const activeParticipants = await meetingParticipantsCollection().countDocuments({
    meeting_id: meetingId,
    left_at: null,
  });

  if (activeParticipants > 0) return;

  const meeting = await meetingsCollection().findOne(
    { meeting_id: meetingId },
    { projection: { _id: 0, started_at: 1, created_at: 1, ended_at: 1 } }
  );

  if (!meeting) return;
  if (meeting.ended_at) return;

  const startedAt = meeting.started_at || meeting.created_at || new Date();
  const endedAt = new Date();
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - new Date(startedAt).getTime()) / 1000)
  );

  await meetingsCollection().updateOne(
    {
      meeting_id: meetingId,
      $or: [{ ended_at: { $exists: false } }, { ended_at: null }],
    },
    {
      $set: {
        status: "completed",
        ended_at: endedAt,
        duration_seconds: durationSeconds,
        updated_at: endedAt,
      },
    }
  );
};

export const saveMeetingSummary = async ({
  meetingId,
  language,
  summaryText,
  transcriptCount,
}) => {
  if (!meetingId || !summaryText) return;

  await meetingSummariesCollection().updateOne(
    { meeting_id: meetingId, language: language || "en" },
    {
      $set: {
        summary_text: summaryText,
        transcript_count: transcriptCount || 0,
        generated_at: new Date(),
        updated_at: new Date(),
      },
      $setOnInsert: {
        meeting_id: meetingId,
        language: language || "en",
        created_at: new Date(),
      },
    },
    { upsert: true }
  );
};
