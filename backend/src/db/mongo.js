import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "tech-meet";

let client;
let db;

export const connectMongo = async () => {
  if (db) return db;

  if (!uri) {
    throw new Error("MONGODB_URI is missing in environment variables");
  }

  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  db = client.db(dbName);

  await db.command({ ping: 1 });
  console.log(`✅ MongoDB connected: ${dbName}`);

  return db;
};

export const getDb = () => {
  if (!db) {
    throw new Error("MongoDB is not connected yet");
  }
  return db;
};

export const closeMongo = async () => {
  if (client) {
    await client.close();
  }
};
