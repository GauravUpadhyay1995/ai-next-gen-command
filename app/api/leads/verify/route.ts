import { NextRequest, NextResponse } from "next/server";
import { verifyEmailMx, isValidEmailFormat } from "@/lib/email-verifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const emails: string[] = Array.isArray(body.emails)
      ? body.emails
      : body.email
      ? [body.email]
      : [];

    if (emails.length === 0) {
      return NextResponse.json(
        { success: false, message: "No email provided for verification." },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      emails.map(async (email) => {
        const clean = String(email || "").trim().toLowerCase();
        if (!isValidEmailFormat(clean)) {
          return {
            email: clean,
            valid: false,
            reason: "invalid_format",
          };
        }
        const mxResult = await verifyEmailMx(clean);
        return {
          email: clean,
          valid: mxResult.valid,
          reason: mxResult.reason || (mxResult.valid ? "active_mx_found" : "no_mx_found"),
          mxRecords: mxResult.mxRecords || [],
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error: any) {
    console.error("[Verify Email API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to verify emails",
      },
      { status: 500 }
    );
  }
}
