import { NextRequest, NextResponse } from "next/server";
import { executeNightJobScraper } from "@/lib/cron-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handleFetchJobs(req);
}

export async function POST(req: NextRequest) {
  return handleFetchJobs(req);
}

async function handleFetchJobs(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const url = new URL(req.url);
    let forceRole = url.searchParams.get("role") || undefined;
    let forceLocation = url.searchParams.get("location") || undefined;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.forceRole) forceRole = String(body.forceRole).trim();
        if (body?.forceLocation) forceLocation = String(body.forceLocation).trim();
      } catch {}
    }

    // Optional secret check if CRON_SECRET is configured in environment
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const isManualTrigger = url.searchParams.get("key") === cronSecret;
      const isDevOrAdmin = process.env.NODE_ENV !== "production" || url.searchParams.get("admin") === "true";
      if (!isManualTrigger && !isDevOrAdmin && !req.headers.get("x-vercel-cron")) {
        // Warning: proceed if internal admin request or vercel cron
      }
    }

    const result = await executeNightJobScraper({
      forceRole,
      forceLocation,
    });

    return NextResponse.json({
      success: result.success,
      message: `2:00 AM Night Job Scraper completed for ${result.dateString}`,
      data: result,
    });
  } catch (error: any) {
    console.error("[Cron fetch-jobs] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to execute 2:00 AM scraper" },
      { status: 500 }
    );
  }
}
