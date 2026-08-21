import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

  // Clear authentication cookies
  response.cookies.delete("gmail_refresh_token");
  response.cookies.delete("gmail_access_token");

  return response;
}
