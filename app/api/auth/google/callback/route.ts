import { NextRequest, NextResponse } from "next/server";
import { createOAuthClient } from "@/lib/google";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { success: false, message: "Authorization code not found" },
        { status: 400 }
      );
    }

    const oauth2Client = createOAuthClient();

    const { tokens } = await oauth2Client.getToken(code);

    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/sent-emails?connected=true`
    );

    if (tokens.refresh_token) {
      response.cookies.set("gmail_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    if (tokens.access_token) {
      response.cookies.set("gmail_access_token", tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      });
    }

    return response;
  } catch (error: any) {
    console.error("Google callback error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Google callback failed",
      },
      { status: 500 }
    );
  }
}