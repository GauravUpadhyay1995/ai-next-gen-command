import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createOAuthClient } from "@/lib/google";
import { loadOwnerToken } from "@/lib/token-storage";
import { getSystemSettings } from "@/lib/access-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const refreshToken = req.cookies.get("gmail_refresh_token")?.value;
  const accessToken = req.cookies.get("gmail_access_token")?.value;
  
  const ownerTokenData = await loadOwnerToken();
  const settings = await getSystemSettings();

  if (!refreshToken && !accessToken) {
    return NextResponse.json({
      connected: false,
      allowCustomerLogin: settings.allowCustomerLogin,
      ownerConnected: !!ownerTokenData,
      ownerEmail: ownerTokenData ? "Store Room" : null,
    });
  }

  try {
    const oauth2Client = createOAuthClient();
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const profileResponse = await gmail.users.getProfile({
      userId: "me",
    });

    const email = profileResponse.data.emailAddress || "";
    const displayEmail = email.toLowerCase() === "rupamsi007@gmail.com" ? "Store Room" : email;
    const isOwner = email.toLowerCase() === String(process.env.OWNER_EMAIL || "rupamsi007@gmail.com").toLowerCase();

    // Query customer category from DB
    let customerCategory = isOwner ? "all" : "job_seeker";
    try {
      const { connectToDatabase } = await import("@/lib/db");
      const { db } = await connectToDatabase();
      const profile = await db.collection("customer_profiles").findOne({ email: email.toLowerCase() });
      if (profile && profile.customerCategory) {
        customerCategory = profile.customerCategory;
      }
    } catch {}

    return NextResponse.json({
      connected: true,
      email: displayEmail,
      rawEmail: email,
      isOwner,
      customerCategory,
      allowCustomerLogin: settings.allowCustomerLogin,
      ownerConnected: !!ownerTokenData,
      ownerEmail: ownerTokenData ? "Store Room" : null,
    });
  } catch (err: any) {
    console.error("Status route error:", err);
    return NextResponse.json({
      connected: false,
      allowCustomerLogin: settings.allowCustomerLogin,
      ownerConnected: !!ownerTokenData,
      ownerEmail: ownerTokenData ? "Store Room" : null,
    });
  }
}