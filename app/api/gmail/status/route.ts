import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const refreshToken = req.cookies.get("gmail_refresh_token")?.value;
  const accessToken = req.cookies.get("gmail_access_token")?.value;

  return NextResponse.json({
    connected: Boolean(refreshToken || accessToken),
  });
}