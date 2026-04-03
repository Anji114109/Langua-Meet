import { getDb } from "./mongo.js";

export const usersCollection = () => getDb().collection("users");
export const meetingsCollection = () => getDb().collection("meetings");
export const meetingParticipantsCollection = () =>
  getDb().collection("meeting_participants");
export const meetingSummariesCollection = () =>
  getDb().collection("meeting_summaries");
