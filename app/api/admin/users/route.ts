import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createOAuthClient } from "@/lib/google";
import {
  getAllowedUsers,
  addAllowedUser,
  updateUserStatus,
  removeAllowedUser,
  isSuperAdmin,
  getSuperAdminEmail,
} from "@/lib/access-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Helper to verify that the incoming request is from the Superadmin/Owner.
 */
async function verifyAdminAuth(req: NextRequest): Promise<{ isAdmin: boolean; email?: string }> {
  const refreshToken = req.cookies.get("gmail_refresh_token")?.value;
  const accessToken = req.cookies.get("gmail_access_token")?.value;

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
    console.error("[Admin API] Auth verification error:", err.message);
    return { isAdmin: false };
  }
}

export async function GET(req: NextRequest) {
  const { isAdmin } = await verifyAdminAuth(req);
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Superadmin access required." },
      { status: 403 }
    );
  }

  const users = await getAllowedUsers();
  return NextResponse.json({
    success: true,
    superAdminEmail: getSuperAdminEmail(),
    count: users.length,
    users,
  });
}

export async function POST(req: NextRequest) {
  const { isAdmin } = await verifyAdminAuth(req);
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Superadmin access required." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { email, name, notes } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Customer email is required." },
        { status: 400 }
      );
    }

    const result = await addAllowedUser(email, name, notes);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to add user." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const { isAdmin } = await verifyAdminAuth(req);
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Superadmin access required." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { email, status } = body;

    if (!email || !status || (status !== "active" && status !== "blocked")) {
      return NextResponse.json(
        { success: false, message: "Valid email and status ('active' | 'blocked') required." },
        { status: 400 }
      );
    }

    const updated = await updateUserStatus(email, status);
    return NextResponse.json({
      success: updated,
      message: `User ${email} status updated to ${status}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update user." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { isAdmin } = await verifyAdminAuth(req);
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Superadmin access required." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email parameter required." },
        { status: 400 }
      );
    }

    const deleted = await removeAllowedUser(email);
    return NextResponse.json({
      success: deleted,
      message: `User ${email} removed from whitelist.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to remove user." },
      { status: 500 }
    );
  }
}
