import { NextRequest, NextResponse } from "next/server";
import { executeMorningEmailDispatcher } from "@/lib/cron-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handleDispatch(req);
}

export async function POST(req: NextRequest) {
  return handleDispatch(req);
}

async function handleDispatch(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let targetDate = url.searchParams.get("date") || undefined;
    let customerEmail = url.searchParams.get("customer") || undefined;
    let simulateOnly = url.searchParams.get("simulate") === "true";

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.targetDate) targetDate = String(body.targetDate).trim();
        if (body?.customerEmail) customerEmail = String(body.customerEmail).trim();
        if (typeof body?.simulateOnly === "boolean") simulateOnly = body.simulateOnly;
      } catch {}
    }

    const result = await executeMorningEmailDispatcher({
      targetDate,
      customerEmail,
      simulateOnly,
    });

    return NextResponse.json({
      success: result.success,
      message: `9:00 AM Morning Email Dispatcher executed for ${result.dateString}`,
      data: result,
    });
  } catch (error: any) {
    console.error("[Cron dispatch-emails] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to execute 9:00 AM email dispatcher" },
      { status: 500 }
    );
  }
}
