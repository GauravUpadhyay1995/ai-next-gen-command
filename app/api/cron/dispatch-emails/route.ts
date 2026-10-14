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
    let batchLimit = url.searchParams.get("batchLimit") ? parseInt(url.searchParams.get("batchLimit")!, 10) : undefined;
    let chainDepth = parseInt(url.searchParams.get("chainDepth") || "1", 10);
    if (isNaN(chainDepth) || chainDepth < 1) chainDepth = 1;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.targetDate) targetDate = String(body.targetDate).trim();
        if (body?.customerEmail) customerEmail = String(body.customerEmail).trim();
        if (typeof body?.simulateOnly === "boolean") simulateOnly = body.simulateOnly;
        if (body?.batchLimit) batchLimit = parseInt(String(body.batchLimit), 10);
        if (body?.chainDepth) chainDepth = parseInt(String(body.chainDepth), 10) || chainDepth;
      } catch {}
    }

    console.log(`[Cron dispatch-emails] Starting execution. Date: ${targetDate || "today"}, Customer: ${customerEmail || "ALL"}, Chain Depth: ${chainDepth}`);

    const result = await executeMorningEmailDispatcher({
      targetDate,
      customerEmail,
      simulateOnly,
      batchLimit,
    });

    // 🔗 Self-Chaining (Recursive Batch Trigger) for autonomous background cron executions
    // If pending jobs remain and we have not exceeded the safety cap (max 15 iterations)
    let nextBatchTriggered = false;
    const MAX_CHAIN_DEPTH = 15;

    if (result.hasMorePending && chainDepth < MAX_CHAIN_DEPTH && !simulateOnly) {
      try {
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
        const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
        let origin = `${proto}://${host}`;
        if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
          origin = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
        } else if (process.env.VERCEL_URL) {
          origin = `https://${process.env.VERCEL_URL}`;
        } else if (process.env.NEXTAUTH_URL) {
          origin = process.env.NEXTAUTH_URL;
        }

        const nextUrl = new URL("/api/cron/dispatch-emails", origin);
        if (targetDate) nextUrl.searchParams.set("date", targetDate);
        if (customerEmail) nextUrl.searchParams.set("customer", customerEmail);
        nextUrl.searchParams.set("chainDepth", String(chainDepth + 1));
        if (batchLimit) nextUrl.searchParams.set("batchLimit", String(batchLimit));

        console.log(`[Cron Dispatch] ⚡ Auto-chaining next batch (Iteration ${chainDepth + 1}/${MAX_CHAIN_DEPTH}). Remaining jobs: ${result.remainingQueueJobs}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        await fetch(nextUrl.toString(), {
          method: "GET",
          headers: {
            "x-cron-chain": "true",
            "x-chain-depth": String(chainDepth + 1),
            ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
          },
          signal: controller.signal,
        }).catch((err) => {
          if (err.name !== "AbortError") {
            console.warn("[Cron Dispatch] Self-chain trigger warning:", err.message);
          }
        });
        clearTimeout(timeoutId);
        nextBatchTriggered = true;
      } catch (chainErr: any) {
        console.error("[Cron Dispatch] Failed to auto-chain next batch:", chainErr.message);
      }
    } else if (chainDepth >= MAX_CHAIN_DEPTH) {
      console.warn(`[Cron Dispatch] ⚠️ Reached maximum chain depth (${MAX_CHAIN_DEPTH}). Halting recursion to avoid runaway executions.`);
    }

    return NextResponse.json({
      success: result.success,
      message: `9:00 AM Morning Email Dispatcher executed for ${result.dateString}`,
      chainDepth,
      nextBatchTriggered,
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
