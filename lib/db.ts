import { MongoClient, Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB = "fetchmail";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB);

  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

export async function saveOwnerToken(email: string, encryptedRefreshToken: string) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("settings");
    await collection.updateOne(
      { key: "owner_token" },
      {
        $set: {
          email: email.toLowerCase(),
          encryptedRefreshToken,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("Failed to save owner token to MongoDB:", error);
    throw error;
  }
}

export async function getOwnerToken(): Promise<{ email: string; encryptedRefreshToken: string } | null> {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("settings");
    const result = await collection.findOne({ key: "owner_token" });
    if (!result) return null;
    return {
      email: result.email,
      encryptedRefreshToken: result.encryptedRefreshToken,
    };
  } catch (error) {
    console.error("Failed to get owner token from MongoDB:", error);
    return null;
  }
}
