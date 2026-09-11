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

export async function saveLeads(leads: any[]): Promise<{ savedCount: number }> {
  if (!leads || leads.length === 0) return { savedCount: 0 };
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("leads");

    let count = 0;
    for (const lead of leads) {
      if (!lead.email) continue;
      await collection.updateOne(
        { email: lead.email.toLowerCase() },
        {
          $set: {
            ...lead,
            email: lead.email.toLowerCase(),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
            status: lead.status || "discovered",
          },
        },
        { upsert: true }
      );
      count++;
    }

    return { savedCount: count };
  } catch (error) {
    console.error("Failed to save leads to MongoDB:", error);
    return { savedCount: 0 };
  }
}

export async function getSavedLeads(limit = 100): Promise<any[]> {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("leads");
    return await collection.find({}).sort({ updatedAt: -1 }).limit(limit).toArray();
  } catch (error) {
    console.error("Failed to get saved leads from MongoDB:", error);
    return [];
  }
}

export async function updateLeadStatus(email: string, status: string): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("leads");
    await collection.updateOne(
      { email: email.toLowerCase() },
      { $set: { status, lastContactedAt: new Date() } }
    );
    return true;
  } catch (error) {
    console.error("Failed to update lead status:", error);
    return false;
  }
}

