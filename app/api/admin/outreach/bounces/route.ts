import { NextRequest, NextResponse } from "next/server";
import { runBounceHealthScan } from "@/lib/bounce-checker";
import { connectToDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const totalBounced = await db.collection("bounced_emails").countDocuments();
    const recentBounces = await db
      .collection("bounced_emails")
      .find({})
      .sort({ bouncedAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      totalBounced,
      recentBounces,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch bounce stats" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const customerEmail = body.customerEmail ? String(body.customerEmail).trim() : undefined;

    const result = await runBounceHealthScan({ customerEmail });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Bounce health scan failed" },
      { status: 500 }
    );
  }
}
