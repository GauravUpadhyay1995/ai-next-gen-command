import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DailyJobQueueItem } from "@/lib/cron-engine";
import { isValidEmailFormat, isDisposableDomain, verifyEmailMx } from "@/lib/email-verifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_KEY = process.env.LEAD_IMPORT_KEY || process.env.CRON_SECRET || "fetchmail_leads_secret_2026";

/**
 * Helper to get local date in YYYY-MM-DD
 */
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * GET /api/leads/import
 * Health check & schema documentation
 */
export async function GET() {
  return NextResponse.json({
    status: "active",
    endpoint: "/api/leads/import",
    method: "POST",
    authentication: {
      type: "Header or Query Parameter",
      options: [
        "Header: 'x-api-key: <YOUR_KEY>'",
        "Header: 'Authorization: Bearer <YOUR_KEY>'",
        "Query: '?key=<YOUR_KEY>'",
      ],
      defaultKey: "fetchmail_leads_secret_2026",
    },
    samplePayload: [
      {
        company: "Innovaccer",
        role: "Node.js Backend Developer",
        email: "hr.tech@innovaccer.com",
        location: "Noida / Delhi-NCR",
        snippet: "3+ years exp in Node.js, Express, MongoDB, Redis, and REST APIs.",
        sourceUrl: "https://innovaccer.com/careers",
      },
    ],
  });
}

/**
 * POST /api/leads/import
 * Receives external leads (e.g. from ChatGPT scheduler, Python script, Make/Zapier)
 * Validates, checks MX records, and queues them directly into daily_jobs_queue.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify API Key
    const authHeader = req.headers.get("authorization") || "";
    const xApiKey = req.headers.get("x-api-key") || "";
    const url = new URL(req.url);
    const queryKey = url.searchParams.get("key") || "";

    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const providedKey = xApiKey || bearerToken || queryKey;

    if (API_KEY && providedKey !== API_KEY) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized: Invalid or missing API key. Provide 'x-api-key' header or '?key=' parameter.",
        },
        { status: 401 }
      );
    }

    // 2. Parse Payload
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body provided." },
        { status: 400 }
      );
    }

    let incomingLeads: any[] = [];
    if (Array.isArray(body)) {
      incomingLeads = body;
    } else if (Array.isArray(body.leads)) {
      incomingLeads = body.leads;
    } else if (body.email && body.company) {
      incomingLeads = [body];
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Payload must be an array of job leads or an object with a 'leads' array.",
        },
        { status: 400 }
      );
    }

    if (incomingLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No leads found in payload to import.",
        importedCount: 0,
      });
    }

    const { db } = await connectToDatabase();
    const queueCollection = db.collection<DailyJobQueueItem>("daily_jobs_queue");
    const dateString = body.date || getTodayDateString();

    const results: Array<{
      email: string;
      company: string;
      role: string;
      status: "queued" | "invalid_email" | "mx_failed";
      reason?: string;
    }> = [];

    let queuedCount = 0;

    // 3. Process & Validate Leads in Parallel Batches
    await Promise.all(
      incomingLeads.map(async (rawItem) => {
        const email = String(rawItem.email || "").toLowerCase().trim();
        const company = String(rawItem.company || rawItem.companyName || "Hiring Team").trim();
        const role = String(rawItem.role || rawItem.jobTitle || rawItem.title || "Node.js Developer").trim();
        const location = String(rawItem.location || "Delhi / Noida").trim();
        const snippet = String(rawItem.snippet || rawItem.description || rawItem.requirements || "").trim();
        const sourceUrl = String(rawItem.sourceUrl || rawItem.url || rawItem.link || "").trim();
        const targetRole = String(rawItem.targetRole || role || "Full Stack Mern Developer").trim();

        // Email validation
        if (!email || !isValidEmailFormat(email) || isDisposableDomain(email)) {
          results.push({ email, company, role, status: "invalid_email", reason: "Format or domain invalid" });
          return;
        }

        // Deep MX check
        const mxCheck = await verifyEmailMx(email, true);
        if (!mxCheck.valid) {
          results.push({ email, company, role, status: "mx_failed", reason: mxCheck.reason || "MX resolution failed" });
          return;
        }

        // Insert into daily_jobs_queue
        const queueDoc: Partial<DailyJobQueueItem> = {
          dateString,
          email,
          company,
          role,
          targetRole,
          location,
          snippet: snippet || `${role} opening at ${company} in ${location}.`,
          sourceUrl,
          sourceType: "chatgpt_scheduler" as any,
          postedDate: rawItem.postedDate || dateString,
          mxValid: true,
          mxDetails: mxCheck.smtpStatus || mxCheck.mxRecords?.[0] || "Active MX Server",
          score: Number(rawItem.score) || 85,
          fetchedAt: new Date(),
        };

        await queueCollection.updateOne(
          { email, dateString },
          {
            $set: queueDoc,
            $setOnInsert: { dispatchedTo: [] },
          },
          { upsert: true }
        );

        queuedCount++;
        results.push({ email, company, role, status: "queued" });
      })
    );

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${incomingLeads.length} leads. ${queuedCount} queued for 9:00 AM dispatch.`,
      dateString,
      received: incomingLeads.length,
      queuedCount,
      failedCount: incomingLeads.length - queuedCount,
      details: results,
    });
  } catch (error: any) {
    console.error("[Leads Import API] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error importing leads" },
      { status: 500 }
    );
  }
}
