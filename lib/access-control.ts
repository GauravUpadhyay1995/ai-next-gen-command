import { connectToDatabase } from "./db";

export type AllowedUser = {
  _id?: any;
  email: string;
  name?: string;
  status: "active" | "blocked";
  addedAt: Date;
  lastLoginAt?: Date;
  notes?: string;
};

export type SystemSettings = {
  allowCustomerLogin: boolean; // default: false (SuperAdmin only)
  updatedAt?: Date;
  updatedBy?: string;
};

export function getSuperAdminEmail(): string {
  return (process.env.OWNER_EMAIL || "rupamsi007@gmail.com").toLowerCase().trim();
}

export function isSuperAdmin(email: string): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  const ownerEnv = (process.env.OWNER_EMAIL || "rupamsi007@gmail.com,singhtanvi0231@gmail.com").toLowerCase().trim();
  const owners = ownerEnv.split(",").map((e) => e.trim());
  return owners.includes(clean) || clean === "rupamsi007@gmail.com" || clean === "singhtanvi0231@gmail.com";
}

/**
 * Retrieves global system settings (e.g. whether customer login is enabled).
 * Default is FALSE (Superadmin only).
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  if (!process.env.MONGODB_URI) {
    return { allowCustomerLogin: false };
  }

  try {
    const { db } = await connectToDatabase();
    const settings = await db.collection("system_settings").findOne({ _id: "global_settings" as any });
    if (!settings) {
      return { allowCustomerLogin: false };
    }
    return {
      allowCustomerLogin: Boolean(settings.allowCustomerLogin),
      updatedAt: settings.updatedAt,
      updatedBy: settings.updatedBy,
    };
  } catch (err) {
    console.warn("[System Settings] Could not fetch settings:", err);
    return { allowCustomerLogin: false };
  }
}

/**
 * Updates global system settings in MongoDB.
 */
export async function updateSystemSettings(
  updates: Partial<SystemSettings>,
  updatedBy?: string
): Promise<SystemSettings> {
  const { db } = await connectToDatabase();
  const collection = db.collection("system_settings");

  const current = await getSystemSettings();
  const nextSettings: SystemSettings = {
    allowCustomerLogin: updates.allowCustomerLogin !== undefined ? Boolean(updates.allowCustomerLogin) : current.allowCustomerLogin,
    updatedAt: new Date(),
    updatedBy: updatedBy || "superadmin",
  };

  await collection.updateOne(
    { _id: "global_settings" as any },
    { $set: nextSettings },
    { upsert: true }
  );

  return nextSettings;
}

/**
 * Checks whether an email is allowed to access the application.
 * Owner/Superadmin is ALWAYS authorized.
 * Customer login is permitted ONLY IF allowCustomerLogin setting is ENABLED by Superadmin.
 */
export async function isUserAuthorized(email: string): Promise<boolean> {
  const cleanEmail = String(email || "").toLowerCase().trim();
  if (!cleanEmail) return false;

  // 1. Superadmin ALWAYS has full access
  if (isSuperAdmin(cleanEmail)) {
    return true;
  }

  if (!process.env.MONGODB_URI) {
    // If DB is not connected, allow Superadmin only
    return false;
  }

  // 2. Check if Customer Login is enabled globally
  const settings = await getSystemSettings();
  if (!settings.allowCustomerLogin) {
    // Customer login is DISABLED by SuperAdmin - block all customer logins
    console.log(`[Access Gatekeeper] Customer login is currently disabled by Superadmin. Blocked: ${cleanEmail}`);
    return false;
  }

  try {
    const { db } = await connectToDatabase();
    
    // 3. Check customer_profiles (Registered by Superadmin)
    const customer = await db.collection("customer_profiles").findOne({
      email: cleanEmail,
      status: { $ne: "blocked" },
    });
    if (customer) return true;

    // 4. Check allowed_users whitelist
    const user = await db.collection("allowed_users").findOne({
      email: cleanEmail,
      status: "active",
    });
    if (user) return true;

    return false;
  } catch (error) {
    console.error("[Access Control] DB check failed:", error);
    return false;
  }
}

/**
 * Records customer's login timestamp.
 */
export async function recordUserLogin(email: string): Promise<void> {
  const cleanEmail = String(email || "").toLowerCase().trim();
  if (!cleanEmail || !process.env.MONGODB_URI) return;

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("allowed_users");
    await collection.updateOne(
      { email: cleanEmail },
      { $set: { lastLoginAt: new Date() } }
    );
  } catch (error) {
    console.warn("[Access Control] Could not update lastLoginAt:", error);
  }
}

/**
 * Adds or updates a customer in the allowed users list.
 */
export async function addAllowedUser(
  email: string,
  name?: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  const cleanEmail = String(email || "").toLowerCase().trim();
  if (!cleanEmail) {
    return { success: false, message: "Valid email is required." };
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("allowed_users");

    await collection.updateOne(
      { email: cleanEmail },
      {
        $set: {
          email: cleanEmail,
          name: name?.trim() || cleanEmail.split("@")[0],
          notes: notes?.trim() || "",
          status: "active",
          updatedAt: new Date(),
        },
        $setOnInsert: {
          addedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return { success: true, message: `User ${cleanEmail} approved successfully.` };
  } catch (error: any) {
    console.error("[Access Control] Failed to add allowed user:", error);
    return { success: false, message: error.message || "Failed to add user to database." };
  }
}

export const authorizeUser = addAllowedUser;

/**
 * Updates an allowed user's status between 'active' and 'blocked'.
 */
export async function updateUserStatus(
  email: string,
  status: "active" | "blocked"
): Promise<boolean> {
  const cleanEmail = String(email || "").toLowerCase().trim();
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("allowed_users");
    const res = await collection.updateOne(
      { email: cleanEmail },
      { $set: { status, updatedAt: new Date() } }
    );
    return res.modifiedCount > 0;
  } catch (error) {
    console.error("[Access Control] Failed to update user status:", error);
    return false;
  }
}

/**
 * Permanently removes a customer from the allowed users whitelist.
 */
export async function removeAllowedUser(email: string): Promise<boolean> {
  const cleanEmail = String(email || "").toLowerCase().trim();
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("allowed_users");
    const res = await collection.deleteOne({ email: cleanEmail });
    return res.deletedCount > 0;
  } catch (error) {
    console.error("[Access Control] Failed to remove user:", error);
    return false;
  }
}

/**
 * Returns all whitelisted users.
 */
export async function getAllowedUsers(): Promise<AllowedUser[]> {
  if (!process.env.MONGODB_URI) return [];

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("allowed_users");
    const users = await collection.find({}).sort({ addedAt: -1 }).toArray();

    return users.map((u) => ({
      email: u.email,
      name: u.name || "",
      status: u.status || "active",
      addedAt: u.addedAt || new Date(),
      lastLoginAt: u.lastLoginAt,
      notes: u.notes || "",
    }));
  } catch (error) {
    console.error("[Access Control] Failed to fetch allowed users:", error);
    return [];
  }
}
