import { NextRequest, NextResponse } from "next/server";
import { createOAuthClient, GMAIL_SCOPES } from "@/lib/google";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";

  const oauth2Client = createOAuthClient();

  const authOptions: any = {
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
  };

  if (token) {
    authOptions.state = JSON.stringify({ token });
  }

  const authUrl = oauth2Client.generateAuthUrl(authOptions);

  return NextResponse.redirect(authUrl);
}