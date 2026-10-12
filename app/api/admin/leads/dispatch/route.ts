import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { createOAuthClient } from "@/lib/google";
import { google } from "googleapis";
import { generateAIPersonalizedPitch, generateSmartHeuristicPitch } from "@/lib/ai-personalizer";
import { sendGmailSmtp, createRawMimeEmailBase64 } from "@/lib/smtp-mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type SelectedLead = {
  id?: string;
  email: string;
  name?: string;
  company?: string;
  role?: string;
  location?: string;
  snippet?: string;
};


function replacePlaceholders(
  text: string,
  context: {
    hrName: string;
    company: string;
    role: string;
    location: string;
    candidateName: string;
    candidateEmail: string;
    experience: string;
    aiPitch: string;
  }
): string {
  return text.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    const cleanKey = String(key).trim().toLowerCase();
    switch (cleanKey) {
      case "name":
      case "hr_name":
      case "recipient_name":
        return context.hrName || "Hiring Team";
      case "company":
      case "company_name":
        return context.company || "your team";
      case "role":
      case "job_role":
      case "position":
        return context.role || "Open Role";
      case "location":
      case "city":
        return context.location || "Remote";
      case "candidate_name":
      case "user_name":
      case "sender_name":
        return context.candidateName || "Candidate";
      case "candidate_email":
      case "user_email":
      case "sender_email":
        return context.candidateEmail || "";
      case "experience":
      case "candidate_experience":
        return context.experience || "relevant";
      case "ai_pitch":
        return context.aiPitch || "";
      default:
        return `{{${key}}}`;
    }
  });
}

export async function POST(req: NextRequest) {
  const logs: string[] = [];
  const log = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] ${msg}`;
    console.log(`[Targeted Dispatch] ${formatted}`);
    logs.push(formatted);
  };

  try {
    const body = await req.json().catch(() => ({}));
    const customerEmail = String(body.customerEmail || "").toLowerCase().trim();
    const selectedLeads: SelectedLead[] = Array.isArray(body.selectedLeads) ? body.selectedLeads : [];
    const subjectTemplate = String(body.subject || "").trim();
    const bodyTemplate = String(body.body || "").trim();
    const useAiPitch = Boolean(body.useAiPitch !== false);
    const simulateOnly = Boolean(body.simulateOnly);

    if (!customerEmail) {
      return NextResponse.json(
        { success: false, message: "Target customer/user email is required." },
        { status: 400 }
      );
    }

    if (selectedLeads.length === 0) {
      return NextResponse.json(
        { success: false, message: "No HR leads were selected for outreach." },
        { status: 400 }
      );
    }

    if (!subjectTemplate || !bodyTemplate) {
      return NextResponse.json(
        { success: false, message: "Email subject and body templates are required." },
        { status: 400 }
      );
    }

    log(`🚀 Initiating Targeted Cold Outreach Dispatcher...`);
    log(`Selected Candidate: ${customerEmail}`);
    log(`Target HR Leads: ${selectedLeads.length} recipients`);
    log(`Mode: ${simulateOnly ? "🧪 SIMULATION DRY-RUN" : "⚡ LIVE AUTHENTICATED DISPATCH"}`);

    const { db } = await connectToDatabase();
    const customerCollection = db.collection("customer_profiles");
    const leadsCollection = db.collection("leads");
    const sentHistoryCollection = db.collection("sent_dispatch_logs");

    // 1. Fetch Candidate Profile
    const customer = await customerCollection.findOne({ email: customerEmail });
    if (!customer) {
      log(`❌ Error: Candidate profile for "${customerEmail}" not found in database.`);
      return NextResponse.json(
        { success: false, message: `Candidate ${customerEmail} not found.`, logs },
        { status: 404 }
      );
    }

    // 2. Determine Authentication Method
    let decryptedAppPassword = "";
    let decryptedRefreshToken = "";
    let sendMethod: "smtp" | "oauth" | null = null;

    if (customer.encryptedAppPassword) {
      try {
        decryptedAppPassword = decrypt(customer.encryptedAppPassword);
        if (decryptedAppPassword) sendMethod = "smtp";
      } catch (e) {
        log(`⚠️ Could not decrypt customer Google App Password.`);
      }
    }

    if (!sendMethod && customer.encryptedRefreshToken) {
      try {
        decryptedRefreshToken = decrypt(customer.encryptedRefreshToken);
        if (decryptedRefreshToken) sendMethod = "oauth";
      } catch (e) {
        log(`⚠️ Could not decrypt customer Google OAuth Token.`);
      }
    }

    if (!sendMethod && !simulateOnly) {
      log(`❌ Candidate ${customerEmail} has not configured Google App Password or 1-Click Google OAuth.`);
      return NextResponse.json(
        {
          success: false,
          message: `Candidate ${customerEmail} is not authenticated (no App Password or OAuth Token).`,
          logs,
        },
        { status: 400 }
      );
    }

    log(`🔑 Sending Engine: ${sendMethod === "smtp" ? "Google SMTP (smtp.gmail.com:465 SSL)" : sendMethod === "oauth" ? "Google Gmail API (OAuth2)" : "Dry-run Simulator"}`);
    if (customer.resumeBase64) {
      log(`📄 Attached Resume: "${customer.resumeName || "resume.pdf"}" (${Math.round((customer.resumeBase64.length * 0.75) / 1024)} KB)`);
    } else {
      log(`ℹ️ Notice: No PDF resume uploaded for this candidate profile.`);
    }

    // Initialize OAuth Client if needed
    let gmailApi: any = null;
    if (sendMethod === "oauth") {
      const oauthClient = createOAuthClient();
      oauthClient.setCredentials({ refresh_token: decryptedRefreshToken });
      gmailApi = google.gmail({ version: "v1", auth: oauthClient });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const results: Array<{
      email: string;
      company: string;
      success: boolean;
      error?: string;
      simulated?: boolean;
    }> = [];

    let totalDispatched = 0;
    let totalFailed = 0;

    // Process leads concurrently in pools of 3
    const CONCURRENCY_BATCH = 3;
    for (let i = 0; i < selectedLeads.length; i += CONCURRENCY_BATCH) {
      const batch = selectedLeads.slice(i, i + CONCURRENCY_BATCH);
      const batchPromises = batch.map(async (lead, batchIdx) => {
        const itemIdx = i + batchIdx + 1;
        const hrEmail = (lead.email || "").toLowerCase().trim();
        const hrCompany = lead.company || "Hiring Team";
        const hrRole = lead.role || customer.role || "Software Engineer";
        const hrName = lead.name || "Hiring Manager";
        const hrLocation = lead.location || customer.location || "Remote";

        if (!hrEmail) {
          return { email: "unknown", company: hrCompany, success: false, error: "Empty email address" };
        }

        try {
          // 1. Generate AI Pitch or Heuristic Pitch
          let aiPitch = "";
          if (useAiPitch || bodyTemplate.includes("{{ai_pitch}}")) {
            try {
              const pitchRes = await generateAIPersonalizedPitch({
                company: hrCompany,
                role: hrRole,
                snippet: lead.snippet || "",
                location: hrLocation,
              });
              aiPitch = pitchRes.pitch;
            } catch (pitchErr) {
              aiPitch = generateSmartHeuristicPitch({
                company: hrCompany,
                role: hrRole,
                snippet: lead.snippet || "",
              });
            }
          }

          // 2. Render Template Variables
          const finalSubject = replacePlaceholders(subjectTemplate, {
            hrName,
            company: hrCompany,
            role: hrRole,
            location: hrLocation,
            candidateName: customer.name || "Candidate",
            candidateEmail: customer.email,
            experience: customer.experience || "1-3 Years",
            aiPitch,
          });

          const finalBody = replacePlaceholders(bodyTemplate, {
            hrName,
            company: hrCompany,
            role: hrRole,
            location: hrLocation,
            candidateName: customer.name || "Candidate",
            candidateEmail: customer.email,
            experience: customer.experience || "1-3 Years",
            aiPitch,
          });

          // 3. Dry Run Simulation Mode
          if (simulateOnly) {
            log(`[${itemIdx}/${selectedLeads.length}] 🧪 [SIMULATION] Prepared cold outreach to ${hrEmail} (${hrCompany}) - Subject: "${finalSubject.slice(0, 45)}..."`);
            return {
              email: hrEmail,
              company: hrCompany,
              success: true,
              simulated: true,
            };
          }

          // 4. Live Dispatch Execution
          if (sendMethod === "smtp") {
            const smtpRes = await sendGmailSmtp({
              fromEmail: customer.email,
              fromName: customer.name,
              appPassword: decryptedAppPassword,
              toEmail: hrEmail,
              subject: finalSubject,
              body: finalBody,
              attachmentName: customer.resumeName || "resume.pdf",
              attachmentMimeType: customer.resumeMimeType || "application/pdf",
              attachmentBase64: customer.resumeBase64,
            });

            if (!smtpRes.success) {
              throw new Error(smtpRes.error || "Google SMTP error");
            }
          } else if (sendMethod === "oauth") {
            const rawMime = createRawMimeEmailBase64({
              toEmail: hrEmail,
              fromEmail: customer.email,
              fromName: customer.name,
              subject: finalSubject,
              body: finalBody,
              attachmentName: customer.resumeName || "resume.pdf",
              attachmentMimeType: customer.resumeMimeType || "application/pdf",
              attachmentBase64: customer.resumeBase64,
            });

            await gmailApi.users.messages.send({
              userId: "me",
              requestBody: { raw: rawMime },
            });
          }

          log(`[${itemIdx}/${selectedLeads.length}] ✅ Successfully sent to ${hrEmail} @ ${hrCompany}`);

          // 5. Record Sent History Log in DB
          try {
            await sentHistoryCollection.insertOne({
              customerEmail: customer.email,
              customerName: customer.name,
              recipientEmail: hrEmail,
              company: hrCompany,
              role: hrRole,
              subject: finalSubject,
              aiPitch,
              dispatchedAt: new Date(),
              dateString: todayStr,
              status: "sent",
              source: "targeted_superadmin_dispatcher",
            });
          } catch {}

          // 6. Update Lead Status in leads collection
          try {
            await leadsCollection.updateOne(
              { email: hrEmail },
              {
                $set: {
                  status: "contacted",
                  lastContactedAt: new Date(),
                  lastContactedBy: customer.email,
                  updatedAt: new Date(),
                },
                $addToSet: { dispatchedTo: customer.email },
              },
              { upsert: false }
            );
          } catch {}

          return { email: hrEmail, company: hrCompany, success: true };
        } catch (dispatchErr: any) {
          const errMsg = dispatchErr.message || "Failed to send email";
          log(`[${itemIdx}/${selectedLeads.length}] ❌ Failed sending to ${hrEmail} (${hrCompany}): ${errMsg}`);
          return { email: hrEmail, company: hrCompany, success: false, error: errMsg };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const res of batchResults) {
        results.push(res);
        if (res.success) totalDispatched++;
        else totalFailed++;
      }

      // Humanized jitter pause between batches to protect sender reputation & avoid bot triggers
      if (i + CONCURRENCY_BATCH < selectedLeads.length && !simulateOnly) {
        await new Promise((r) => setTimeout(r, 1800 + Math.random() * 2200));
      }
    }

    // 7. Increment customer total sent count
    if (totalDispatched > 0 && !simulateOnly) {
      try {
        await customerCollection.updateOne(
          { email: customer.email },
          {
            $inc: { totalSentCount: totalDispatched },
            $set: { lastActiveAt: new Date() },
          }
        );
      } catch {}
    }

    log(`🏁 Targeted Dispatch Finished. Dispatched: ${totalDispatched}, Failed: ${totalFailed}`);

    return NextResponse.json({
      success: true,
      simulateOnly,
      totalSelected: selectedLeads.length,
      totalDispatched,
      totalFailed,
      customerEmail: customer.email,
      customerName: customer.name,
      results,
      logs,
    });
  } catch (error: any) {
    console.error("[Targeted Dispatch API] Fatal error:", error);
    log(`[FATAL ERROR] ${error.message}`);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Targeted dispatch failed",
        logs,
      },
      { status: 500 }
    );
  }
}
