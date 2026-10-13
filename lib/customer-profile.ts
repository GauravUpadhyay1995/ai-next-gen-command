import { connectToDatabase } from "./db";
import { encrypt, decrypt } from "./crypto";
import crypto from "crypto";

export type CustomerProfile = {
  _id?: any;
  name: string;
  email: string;
  role: string;
  experience: string; // e.g., "Fresher", "1-3 Years", "3-5 Years", "5+ Years"
  location: string;
  dailyLimit: number; // e.g., 20
  customerCategory?: "job_seeker" | "b2b_lead_finder" | "all";
  resumeName?: string;
  resumeBase64?: string;
  resumeMimeType?: string;
  encryptedRefreshToken?: string;
  encryptedAppPassword?: string;
  appPassword?: string; // Raw Google App Password (not hashed or encrypted)
  authMethod?: "app_password" | "oauth" | "both";
  status: "pending_auth" | "active" | "paused" | "blocked";
  connectToken: string;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
  totalSentCount: number;
  notes?: string;
};

export function generateConnectToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * Creates or updates a customer profile in MongoDB.
 */
export async function createCustomerProfile(data: {
  name: string;
  email: string;
  role: string;
  experience: string;
  location?: string;
  dailyLimit?: number;
  customerCategory?: "job_seeker" | "b2b_lead_finder" | "all";
  googleAppPassword?: string;
  resumeName?: string;
  resumeBase64?: string;
  resumeMimeType?: string;
  notes?: string;
}): Promise<{ success: boolean; profile?: CustomerProfile; message?: string }> {
  const cleanEmail = String(data.email || "").toLowerCase().trim();
  if (!cleanEmail) {
    return { success: false, message: "Valid customer email is required." };
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("customer_profiles");

    const existing = await collection.findOne({ email: cleanEmail });
    const connectToken = existing?.connectToken || generateConnectToken();

    const profileDoc: Partial<CustomerProfile> = {
      name: data.name?.trim() || cleanEmail.split("@")[0],
      email: cleanEmail,
      role: data.role?.trim() || "Software Engineer",
      experience: data.experience?.trim() || "1-3 Years",
      location: data.location?.trim() || "Remote",
      dailyLimit: data.dailyLimit || 20,
      customerCategory: data.customerCategory || "job_seeker",
      notes: data.notes?.trim() || "",
      connectToken,
      updatedAt: new Date(),
    };

    // If Google App Password is provided, save in raw format (no encryption or hashing) and activate immediately
    const cleanAppPass = (data.googleAppPassword || "").replace(/\s+/g, "");
    if (cleanAppPass) {
      profileDoc.appPassword = cleanAppPass;
      profileDoc.authMethod = existing?.encryptedRefreshToken ? "both" : "app_password";
      profileDoc.status = "active";
    }

    if (data.resumeBase64) {
      profileDoc.resumeBase64 = data.resumeBase64;
      profileDoc.resumeName = data.resumeName || "resume.pdf";
      profileDoc.resumeMimeType = data.resumeMimeType || "application/pdf";
    }

    if (!existing) {
      if (!profileDoc.status) {
        profileDoc.status = "pending_auth";
      }
      profileDoc.createdAt = new Date();
      profileDoc.totalSentCount = 0;
    }

    const updateOps: any = { $set: profileDoc };
    if (cleanAppPass) {
      updateOps.$unset = { encryptedAppPassword: "" };
    }

    await collection.updateOne(
      { email: cleanEmail },
      updateOps,
      { upsert: true }
    );

    // Also auto-whitelist in allowed_users
    try {
      await db.collection("allowed_users").updateOne(
        { email: cleanEmail },
        {
          $set: {
            email: cleanEmail,
            name: data.name?.trim() || cleanEmail.split("@")[0],
            notes: "Customer Profile registered by Superadmin",
            status: "active",
            updatedAt: new Date(),
          },
          $setOnInsert: {
            addedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch {}

    const saved = await collection.findOne({ email: cleanEmail });
    return {
      success: true,
      profile: saved as any,
      message: `Profile for ${cleanEmail} saved successfully.`,
    };
  } catch (error: any) {
    console.error("[CustomerProfile] Error saving profile:", error);
    return { success: false, message: error.message || "Database error." };
  }
}

/**
 * Saves customer's Google OAuth refresh token when they complete 1-time connect.
 */
export async function saveCustomerRefreshToken(
  email: string,
  refreshToken: string
): Promise<boolean> {
  const cleanEmail = String(email || "").toLowerCase().trim();
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("customer_profiles");

    const encrypted = encrypt(refreshToken);
    const res = await collection.updateOne(
      { email: cleanEmail },
      {
        $set: {
          encryptedRefreshToken: encrypted,
          status: "active",
          lastActiveAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return res.modifiedCount > 0 || res.upsertedCount > 0;
  } catch (error) {
    console.error("[CustomerProfile] Failed to save customer refresh token:", error);
    return false;
  }
}

/**
 * Helper to get raw app password from a customer profile document,
 * decrypting legacy encryptedAppPassword if needed.
 */
export function getCustomerRawAppPassword(customer: Partial<CustomerProfile>): string {
  if (customer.appPassword) {
    return customer.appPassword;
  }
  if (customer.encryptedAppPassword) {
    if (customer.encryptedAppPassword.includes(":")) {
      try {
        return decrypt(customer.encryptedAppPassword);
      } catch {
        return customer.encryptedAppPassword;
      }
    }
    return customer.encryptedAppPassword;
  }
  return "";
}

/**
 * Retrieves a customer profile by their 1-time connect token.
 */
export async function getCustomerByConnectToken(
  token: string
): Promise<CustomerProfile | null> {
  if (!token) return null;
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("customer_profiles");
    const doc = await collection.findOne({ connectToken: token });
    if (!doc) return null;
    const rawAppPass = getCustomerRawAppPassword(doc as any);
    if (rawAppPass) {
      (doc as any).appPassword = rawAppPass;
    }
    return doc as any;
  } catch (error) {
    console.error("[CustomerProfile] Failed to find customer by token:", error);
    return null;
  }
}

/**
 * Retrieves all customer profiles with raw app password resolved.
 */
export async function getAllCustomerProfiles(): Promise<CustomerProfile[]> {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("customer_profiles");
    const docs = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return docs.map((doc: any) => {
      const rawAppPass = getCustomerRawAppPassword(doc);
      if (rawAppPass) {
        doc.appPassword = rawAppPass;
      }
      return doc as CustomerProfile;
    });
  } catch (error) {
    console.error("[CustomerProfile] Failed to fetch customer profiles:", error);
    return [];
  }
}

/**
 * Retrieves only active customer profiles who have connected their Gmail token or configured Google App Password.
 */
export async function getActiveCustomerProfiles(): Promise<CustomerProfile[]> {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("customer_profiles");
    const docs = await collection
      .find({
        status: "active",
        $or: [
          { appPassword: { $exists: true, $ne: "" } },
          { encryptedAppPassword: { $exists: true, $ne: "" } },
          { encryptedRefreshToken: { $exists: true, $ne: "" } },
        ],
      })
      .toArray();
    return docs.map((doc: any) => {
      const rawAppPass = getCustomerRawAppPassword(doc);
      if (rawAppPass) {
        doc.appPassword = rawAppPass;
      }
      return doc as CustomerProfile;
    });
  } catch (error) {
    console.error("[CustomerProfile] Failed to fetch active profiles:", error);
    return [];
  }
}

/**
 * Updates customer status or details.
 */
export async function updateCustomerStatus(
  email: string,
  status: "pending_auth" | "active" | "paused" | "blocked"
): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("customer_profiles");
    const res = await collection.updateOne(
      { email: email.toLowerCase().trim() },
      { $set: { status, updatedAt: new Date() } }
    );
    return res.modifiedCount > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Deletes a customer profile.
 */
export async function deleteCustomerProfile(email: string): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("customer_profiles");
    const res = await collection.deleteOne({ email: email.toLowerCase().trim() });
    return res.deletedCount > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Updates a candidate's Google App Password in raw format (no hashing or encryption).
 */
export async function updateCustomerAppPassword(
  email: string,
  appPassword: string
): Promise<boolean> {
  const cleanEmail = String(email || "").toLowerCase().trim();
  const cleanAppPass = (appPassword || "").replace(/\s+/g, "");
  if (!cleanEmail) return false;

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("customer_profiles");
    const res = await collection.updateOne(
      { email: cleanEmail },
      {
        $set: {
          appPassword: cleanAppPass,
          authMethod: "app_password",
          status: cleanAppPass ? "active" : "pending_auth",
          updatedAt: new Date(),
        },
        $unset: { encryptedAppPassword: "" },
      }
    );
    return res.modifiedCount > 0 || res.matchedCount > 0;
  } catch (error) {
    console.error("[CustomerProfile] Failed to update customer app password:", error);
    return false;
  }
}
