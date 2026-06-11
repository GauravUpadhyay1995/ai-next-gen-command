import { NextRequest, NextResponse } from "next/server";
import { createOAuthClient } from "@/lib/google";
import { google } from "googleapis";
import { storeOwnerRefreshToken } from "@/lib/token-storage";

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

    // Fetch user profile to check if they are the owner
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const profileResponse = await gmail.users.getProfile({
      userId: "me",
    });
    const email = (profileResponse.data.emailAddress || "").toLowerCase();

    const ownerEmail = (process.env.OWNER_EMAIL || "owner@gmail.com").toLowerCase();
    const isOwner = email === ownerEmail;

    if (isOwner && tokens.refresh_token) {
      await storeOwnerRefreshToken(email, tokens.refresh_token);
      console.log(`Owner ${email} connected successfully and token stored.`);
    }

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
