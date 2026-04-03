import express from "express";
import {
  meetingsCollection,
  meetingParticipantsCollection,
  meetingSummariesCollection,
  usersCollection,
} from "../db/collections.js";
import { requireAuth } from "../middleware/auth.js";
import { hasMeetingAccess } from "../services/meetingPersistenceService.js";

const router = express.Router();

const computeDuration = (meeting) => {
  if (typeof meeting?.duration_seconds === "number") {
    return meeting.duration_seconds;
  }

  const startedAt = meeting?.started_at || meeting?.created_at;
  const endedAt = meeting?.ended_at;

  if (!startedAt || !endedAt) return null;

  const seconds = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, seconds);
};

router.get("/meetings/member", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;

    const entries = await meetingParticipantsCollection()
      .aggregate([
        {
          $match: {
            user_id: userId,
            role: { $ne: "host" },
          },
        },
        {
          $lookup: {
            from: "meetings",
            localField: "meeting_id",
            foreignField: "meeting_id",
            as: "meeting",
          },
        },
        { $unwind: { path: "$meeting", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "meeting_participants",
            localField: "meeting_id",
            foreignField: "meeting_id",
            as: "participants",
          },
        },
        {
          $project: {
            _id: 0,
            meetingId: "$meeting_id",
            host: { $ifNull: ["$meeting.host_name", "Host"] },
            subject: { $ifNull: ["$meeting.subject", "General Discussion"] },
            participantCount: { $size: "$participants" },
            startedAt: { $ifNull: ["$meeting.started_at", "$meeting.created_at"] },
            endedAt: "$meeting.ended_at",
            durationSeconds: "$meeting.duration_seconds",
          },
        },
        { $sort: { startedAt: -1 } },
      ])
      .toArray();

    const meetings = entries.map((item) => ({
      ...item,
      durationSeconds: computeDuration(item),
    }));

    return res.json({ meetings });
  } catch (err) {
    console.error("Member meeting history error:", err.message);
    return res.status(500).json({ error: "Failed to fetch member meeting history" });
  }
});

router.get("/meetings/host", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;

    const hostEntries = await meetingParticipantsCollection()
      .aggregate([
        {
          $match: {
            user_id: userId,
            role: "host",
          },
        },
        {
          $lookup: {
            from: "meetings",
            localField: "meeting_id",
            foreignField: "meeting_id",
            as: "meeting",
          },
        },
        { $unwind: { path: "$meeting", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "meeting_participants",
            localField: "meeting_id",
            foreignField: "meeting_id",
            as: "participants",
          },
        },
        {
          $project: {
            _id: 0,
            meetingId: "$meeting_id",
            subject: { $ifNull: ["$meeting.subject", "General Discussion"] },
            participantCount: { $size: "$participants" },
            participants: "$participants",
            startedAt: { $ifNull: ["$meeting.started_at", "$meeting.created_at"] },
            endedAt: "$meeting.ended_at",
            durationSeconds: "$meeting.duration_seconds",
          },
        },
        { $sort: { startedAt: -1 } },
      ])
      .toArray();

    const participantUserIds = [
      ...new Set(
        hostEntries
          .flatMap((entry) => (entry.participants || []).map((participant) => participant.user_id))
          .filter(Boolean)
      ),
    ];

    const users = await usersCollection()
      .find(
        { google_id: { $in: participantUserIds } },
        { projection: { _id: 0, google_id: 1, email: 1, full_name: 1 } }
      )
      .toArray();

    const userMap = new Map(users.map((user) => [user.google_id, user]));

    const meetings = hostEntries.map((entry) => {
      const participants = (entry.participants || [])
        .filter((participant) => participant.role !== "host")
        .map((participant) => {
          const user = userMap.get(participant.user_id);
          return {
            userId: participant.user_id,
            fullName: user?.full_name || participant.display_name || "Participant",
            email: user?.email || "-",
          };
        });

      return {
        meetingId: entry.meetingId,
        subject: entry.subject,
        participantCount: entry.participantCount,
        participants,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        durationSeconds: computeDuration(entry),
      };
    });

    return res.json({ meetings });
  } catch (err) {
    console.error("Host meeting history error:", err.message);
    return res.status(500).json({ error: "Failed to fetch host meeting history" });
  }
});

router.get("/summaries", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;

    const membershipDocs = await meetingParticipantsCollection()
      .find(
        { user_id: userId },
        { projection: { _id: 0, meeting_id: 1 } }
      )
      .toArray();

    const meetingIds = [...new Set(membershipDocs.map((doc) => doc.meeting_id).filter(Boolean))];

    if (!meetingIds.length) {
      return res.json({ summaries: [] });
    }

    const summaries = await meetingSummariesCollection()
      .aggregate([
        {
          $match: {
            meeting_id: { $in: meetingIds },
          },
        },
        {
          $lookup: {
            from: "meetings",
            localField: "meeting_id",
            foreignField: "meeting_id",
            as: "meeting",
          },
        },
        { $unwind: { path: "$meeting", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            meetingId: "$meeting_id",
            language: { $ifNull: ["$language", "en"] },
            host: { $ifNull: ["$meeting.host_name", "Host"] },
            subject: { $ifNull: ["$meeting.subject", "General Discussion"] },
            startedAt: { $ifNull: ["$meeting.started_at", "$meeting.created_at"] },
            endedAt: "$meeting.ended_at",
            durationSeconds: "$meeting.duration_seconds",
            generatedAt: { $ifNull: ["$generated_at", "$updated_at"] },
          },
        },
        { $sort: { generatedAt: -1 } },
      ])
      .toArray();

    const normalized = summaries.map((item) => ({
      ...item,
      durationSeconds: computeDuration(item),
    }));

    return res.json({ summaries: normalized });
  } catch (err) {
    console.error("Summary history error:", err.message);
    return res.status(500).json({ error: "Failed to fetch summary history" });
  }
});

router.get("/meetings/:meetingId/meta", requireAuth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user?.userId;

    const allowed = await hasMeetingAccess({ meetingId, userId });
    if (!allowed) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const meeting = await meetingsCollection().findOne(
      { meeting_id: meetingId },
      {
        projection: {
          _id: 0,
          meeting_id: 1,
          host_name: 1,
          subject: 1,
          started_at: 1,
          created_at: 1,
          ended_at: 1,
          duration_seconds: 1,
          status: 1,
        },
      }
    );

    if (!meeting) {
      return res.json({
        meetingId,
        host: "Host",
        subject: "General Discussion",
        startedAt: new Date(),
        endedAt: null,
        durationSeconds: null,
        status: "pending",
      });
    }

    return res.json({
      meetingId: meeting.meeting_id,
      host: meeting.host_name || "Host",
      subject: meeting.subject || "General Discussion",
      startedAt: meeting.started_at || meeting.created_at,
      endedAt: meeting.ended_at || null,
      durationSeconds: computeDuration(meeting),
      status: meeting.status || "active",
    });
  } catch (err) {
    console.error("Meeting meta error:", err.message);
    return res.status(500).json({ error: "Failed to fetch meeting metadata" });
  }
});

export default router;
