import { NextRequest, NextResponse } from "next/server";
import { executeMorningEmailDispatcher } from "@/lib/cron-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const customerEmail = body.customerEmail ? String(body.customerEmail).toLowerCase().trim() : undefined;
    const simulateOnly = Boolean(body.simulateOnly);
    const targetDate = body.targetDate ? String(body.targetDate) : undefined;

    const batchLimit = body.batchLimit ? Number(body.batchLimit) : undefined;

    console.log(`[1-Click Outreach] Received trigger. Target: ${customerEmail || "ALL_ACTIVE"}, Simulate: ${simulateOnly}, BatchLimit: ${batchLimit || "default"}`);

    const result = await executeMorningEmailDispatcher({
      customerEmail,
      simulateOnly,
      targetDate,
      batchLimit,
    });

    return NextResponse.json({
      success: result.success,
      dateString: result.dateString,
      totalCustomers: result.totalCustomers,
      totalEmailsDispatched: result.totalEmailsDispatched,
      totalSkipped: result.totalSkipped,
      customerReports: result.customerReports,
      hasMorePending: result.hasMorePending,
      remainingQueueJobs: result.remainingQueueJobs,
      logs: result.logs,
    });
  } catch (error: any) {
    console.error("[1-Click Outreach API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Outreach dispatch execution failed",
        logs: [`[FATAL ERROR] ${error.message}`],
      },
      { status: 500 }
    );
  }
}
