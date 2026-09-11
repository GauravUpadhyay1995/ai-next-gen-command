import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createOAuthClient } from "@/lib/google";
import {
  getSystemSettings,
  updateSystemSettings,
  isSuperAdmin,
  getSuperAdminEmail,
} from "@/lib/access-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Helper to verify SuperAdmin authentication.
 */
async function verifyAdminAuth(req: NextRequest): Promise<{ isAdmin: boolean; email?: string }> {
  const refreshToken = req.cookies.get("gmail_refresh_token")?.value;
  const accessToken = req.cookies.get("gmail_access_token")?.value;

  // Check development or fallback bypass
  if (process.env.NODE_ENV === "development" && !refreshToken && !accessToken) {
    return { isAdmin: true, email: getSuperAdminEmail() };
  }

  if (!refreshToken && !accessToken) {
    return { isAdmin: false };
  }

  try {
    const oauth2Client = createOAuthClient();
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = (profile.data.emailAddress || "").toLowerCase().trim();

    return {
      isAdmin: isSuperAdmin(email),
      email,
    };
  } catch (err: any) {
    console.error("[Settings API] Auth verification error:", err.message);
    return { isAdmin: false };
  }
}

export async function GET(req: NextRequest) {
  try {
    const settings = await getSystemSettings();
    return NextResponse.json({
      success: true,
      settings,
      superAdminEmail: getSuperAdminEmail(),
    });
  } catch (error: any) {
    console.error("[Settings API] GET error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { isAdmin, email } = await verifyAdminAuth(req);
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Superadmin access required to change system settings." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { allowCustomerLogin } = body;

    const updated = await updateSystemSettings(
      {
        allowCustomerLogin: Boolean(allowCustomerLogin),
      },
      email || "superadmin"
    );

    return NextResponse.json({
      success: true,
      message: `System settings updated: Customer Login is now ${
        updated.allowCustomerLogin ? "ENABLED" : "DISABLED (Superadmin Only)"
      }.`,
      settings: updated,
    });
  } catch (error: any) {
    console.error("[Settings API] POST error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
