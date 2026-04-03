import {
  meetingsCollection,
  meetingParticipantsCollection,
  meetingSummariesCollection,
  usersCollection,
} from "./collections.js";

export const ensureIndexes = async () => {
  await usersCollection().createIndex({ google_id: 1 }, { unique: true });
  await usersCollection().createIndex({ email: 1 }, { unique: true });

  await meetingsCollection().createIndex({ meeting_id: 1 }, { unique: true });
  await meetingsCollection().createIndex({ host_user_id: 1, created_at: -1 });

  await meetingParticipantsCollection().createIndex(
    { meeting_id: 1, user_id: 1 },
    { unique: true }
  );
  await meetingParticipantsCollection().createIndex({ meeting_id: 1, joined_at: -1 });
  await meetingParticipantsCollection().createIndex({ user_id: 1, role: 1, joined_at: -1 });

  await meetingSummariesCollection().createIndex(
    { meeting_id: 1, language: 1 },
    { unique: true }
  );
  await meetingSummariesCollection().createIndex({ meeting_id: 1, generated_at: -1 });
};
