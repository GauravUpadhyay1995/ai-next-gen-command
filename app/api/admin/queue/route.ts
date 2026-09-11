import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateString = url.searchParams.get("date");
    const limit = Number(url.searchParams.get("limit")) || 50;

    const { db } = await connectToDatabase();
    const collection = db.collection("daily_jobs_queue");

    const query: any = {};
    if (dateString) {
      query.dateString = dateString;
    }

    const jobs = await collection.find(query).sort({ fetchedAt: -1 }).limit(limit).toArray();
    const totalCount = await collection.countDocuments(query);

    return NextResponse.json({
      success: true,
      jobs,
      totalCount,
    });
  } catch (error: any) {
    console.error("[Queue API] GET error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch queued jobs" },
      { status: 500 }
    );
  }
}
