import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerEmail = searchParams.get("customerEmail");
    const limit = Number(searchParams.get("limit")) || 200;

    const { db } = await connectToDatabase();
    const query: any = {};
    if (customerEmail) {
      query.customerEmail = customerEmail.toLowerCase().trim();
    }

    const logs = await db
      .collection("sent_dispatch_logs")
      .find(query)
      .sort({ dispatchedAt: -1 })
      .limit(limit)
      .toArray();

    const totalSent = await db.collection("sent_dispatch_logs").countDocuments(query);
    const uniqueRecipients = (await db.collection("sent_dispatch_logs").distinct("recipientEmail", query)).length;
    const uniqueCompanies = (await db.collection("sent_dispatch_logs").distinct("company", query)).length;

    return NextResponse.json({
      success: true,
      logs: logs.map((log) => ({
        ...log,
        _id: log._id.toString(),
      })),
      stats: {
        totalSent,
        uniqueRecipients,
        uniqueCompanies,
      },
    });
  } catch (error: any) {
    console.error("[Sent History API] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch sent history" },
      { status: 500 }
    );
  }
}
