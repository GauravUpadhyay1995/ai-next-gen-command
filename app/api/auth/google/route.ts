import { NextResponse } from "next/server";
import { createOAuthClient, GMAIL_SCOPES } from "@/lib/google";

export async function GET() {
  const oauth2Client = createOAuthClient();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
  });

  return NextResponse.redirect(authUrl);
}