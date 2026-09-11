import { connectToDatabase } from "./db";
import { getActiveCustomerProfiles, CustomerProfile } from "./customer-profile";
import { searchPublicJobFeeds, searchGoogleHiringPosts, DiscoveredLead } from "./lead-finder";
import { verifyEmailMx, isValidEmailFormat, isDisposableDomain } from "./email-verifier";
import { decrypt } from "./crypto";
import { createOAuthClient } from "./google";
import { google } from "googleapis";
import { generateAIPersonalizedPitch, generateSmartHeuristicPitch } from "./ai-personalizer";
import { sendGmailSmtp } from "./smtp-mailer";

export type DailyJobQueueItem = {
  _id?: any;
  dateString: string; // YYYY-MM-DD
  email: string;
  company: string;
  role: string;
  location: string;
  snippet: string;
  sourceUrl: string;
  sourceType: string;
  postedDate?: string;
  mxValid: boolean;
  mxDetails?: string;
  dispatchedTo: string[]; // customer emails
  fetchedAt: Date;
};

export type CronLog = {
  type: "fetch_jobs_2am" | "dispatch_emails_9am";
  status: "success" | "partial" | "failed";
  timestamp: Date;
  summary: string;
  details: any;
};

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sanitizeHeader(value: string) {
  return String(value || "").replace(/(\r\n|\n|\r)/gm, " ").trim();
}

function chunkBase64(base64: string) {
  return base64.match(/.{1,76}/g)?.join("\r\n") || base64;
}

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function createRawMimeEmail({
  to,
  fromEmail,
  fromName,
  subject,
  body,
  attachmentName,
  attachmentMimeType,
  attachmentBase64,
}: {
  to: string;
  fromEmail?: string;
  fromName?: string;
  subject: string;
  body: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentBase64?: string;
}) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const safeSubject = sanitizeHeader(subject);
  const fromHeader = fromName && fromEmail ? `${fromName} <${fromEmail}>` : fromEmail || "";

  const headers = [
    `To: ${to}`,
    fromHeader ? `From: ${fromHeader}` : "",
    `Subject: ${safeSubject}`,
    `MIME-Version: 1.0`,
  ].filter(Boolean);

  if (attachmentBase64 && attachmentName) {
    const safeAttachmentName = sanitizeHeader(attachmentName);
    const mimeType = attachmentMimeType || "application/pdf";

    const messageParts = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      body,
      ``,
      `--${boundary}`,
      `Content-Type: ${mimeType}; name="${safeAttachmentName}"`,
      `Content-Disposition: attachment; filename="${safeAttachmentName}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      chunkBase64(attachmentBase64),
      ``,
      `--${boundary}--`,
    ];
    return base64UrlEncode(messageParts.join("\r\n"));
  } else {
    const messageParts = [
      ...headers,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      body,
    ];
    return base64UrlEncode(messageParts.join("\r\n"));
  }
}

/**
 * PHASE 1: Night 2:00 AM Cron Execution
 * Gathers target roles & locations from all active customers, searches job feeds, verifies MX,
 * and pushes fresh leads into the daily_jobs_queue collection.
 */
export async function executeNightJobScraper(options?: {
  forceRole?: string;
  forceLocation?: string;
}): Promise<{
  success: boolean;
  dateString: string;
  rolesProcessed: string[];
  totalDiscovered: number;
  totalMxValid: number;
  insertedCount: number;
  logs: string[];
}> {
  const logs: string[] = [];
  const dateString = getTodayString();
  logs.push(`[${new Date().toLocaleTimeString()}] Starting 2:00 AM Job Scraper for Date: ${dateString}`);

  try {
    const { db } = await connectToDatabase();
    const queueCollection = db.collection("daily_jobs_queue");
    const logsCollection = db.collection("cron_execution_logs");

    // 1. Fetch active customer profiles
    const activeCustomers = await getActiveCustomerProfiles();
    logs.push(`[${new Date().toLocaleTimeString()}] Found ${activeCustomers.length} active customer profiles.`);

    let targetRoles: string[] = [];
    let targetLocations: string[] = [];

    if (options?.forceRole) {
      targetRoles = [options.forceRole.trim()];
    } else {
      targetRoles = Array.from(
        new Set(activeCustomers.map((c) => c.role?.trim()).filter(Boolean))
      );
    }

    if (options?.forceLocation) {
      targetLocations = [options.forceLocation.trim()];
    } else {
      targetLocations = Array.from(
        new Set(activeCustomers.map((c) => c.location?.trim()).filter(Boolean))
      );
    }

    // Default fallbacks if no customers registered yet
    if (targetRoles.length === 0) {
      targetRoles = ["Software Engineer", "Full Stack Developer", "Frontend Developer"];
      logs.push(`[${new Date().toLocaleTimeString()}] No specific customer roles found. Using default targets: ${targetRoles.join(", ")}`);
    }
    if (targetLocations.length === 0) {
      targetLocations = ["Remote"];
    }

    let allDiscovered: DiscoveredLead[] = [];

    // 2. Query feeds for each role
    for (const role of targetRoles) {
      logs.push(`[${new Date().toLocaleTimeString()}] Fetching jobs for target role: "${role}"...`);
      for (const loc of targetLocations.slice(0, 2)) {
        try {
          const feedLeads = await searchPublicJobFeeds(role, loc);
          logs.push(` -> Public feeds returned ${feedLeads.length} leads for "${role}" (${loc})`);
          allDiscovered = allDiscovered.concat(feedLeads);
        } catch (err: any) {
          logs.push(` -> Feed fetch error for "${role}": ${err.message}`);
        }

        // Also query Google Intent search if configured
        if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
          try {
            const googleLeads = await searchGoogleHiringPosts(role, loc);
            logs.push(` -> Google hiring posts returned ${googleLeads.length} leads for "${role}"`);
            allDiscovered = allDiscovered.concat(googleLeads);
          } catch (err: any) {
            logs.push(` -> Google search error for "${role}": ${err.message}`);
          }
        }
      }
    }

    // Deduplicate by email
    const uniqueMap = new Map<string, DiscoveredLead>();
    for (const item of allDiscovered) {
      const cleanEmail = item.email?.trim().toLowerCase();
      if (cleanEmail && isValidEmailFormat(cleanEmail) && !isDisposableDomain(cleanEmail)) {
        if (!uniqueMap.has(cleanEmail)) {
          uniqueMap.set(cleanEmail, item);
        }
      }
    }

    const uniqueLeads = Array.from(uniqueMap.values());
    logs.push(`[${new Date().toLocaleTimeString()}] Total unique formatted leads: ${uniqueLeads.length}`);

    // Verify MX Records in fast parallel batches
    const candidatePool = uniqueLeads.slice(0, 50);
    const mxCheckResults = await Promise.allSettled(
      candidatePool.map(async (lead) => {
        const mxCheck = await verifyEmailMx(lead.email);
        if (mxCheck.valid) {
          return {
            ...lead,
            mxValid: true,
            mxDetails: mxCheck.mxRecords?.[0] || "Active MX Host",
          };
        }
        return null;
      })
    );

    const mxValidLeads: DiscoveredLead[] = [];
    for (const res of mxCheckResults) {
      if (res.status === "fulfilled" && res.value) {
        mxValidLeads.push(res.value);
      }
    }

    logs.push(`[${new Date().toLocaleTimeString()}] Total DNS MX Valid leads: ${mxValidLeads.length}`);

    // 3. Insert / Upsert into daily_jobs_queue
    let insertedCount = 0;
    for (const lead of mxValidLeads) {
      const queueDoc: Partial<DailyJobQueueItem> = {
        dateString,
        email: lead.email.toLowerCase().trim(),
        company: lead.company || "Hiring Team",
        role: lead.role || "Target Role",
        location: lead.location || "Remote",
        snippet: lead.snippet || "",
        sourceUrl: lead.sourceUrl || "",
        sourceType: lead.sourceType || "public_feed",
        postedDate: lead.postedDate || new Date().toLocaleDateString(),
        mxValid: true,
        mxDetails: lead.mxDetails,
        fetchedAt: new Date(),
      };

      const result = await queueCollection.updateOne(
        { email: queueDoc.email, dateString },
        {
          $set: queueDoc,
          $setOnInsert: { dispatchedTo: [] },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0 || result.modifiedCount > 0) {
        insertedCount++;
      }
    }

    logs.push(`[${new Date().toLocaleTimeString()}] Successfully queued ${insertedCount} fresh jobs for ${dateString}.`);

    // Record execution log
    await logsCollection.insertOne({
      type: "fetch_jobs_2am",
      status: "success",
      timestamp: new Date(),
      summary: `Queued ${insertedCount} jobs across ${targetRoles.length} roles for ${dateString}`,
      details: {
        dateString,
        rolesProcessed: targetRoles,
        totalDiscovered: allDiscovered.length,
        totalMxValid: mxValidLeads.length,
        insertedCount,
      },
    });

    return {
      success: true,
      dateString,
      rolesProcessed: targetRoles,
      totalDiscovered: allDiscovered.length,
      totalMxValid: mxValidLeads.length,
      insertedCount,
      logs,
    };
  } catch (error: any) {
    logs.push(`[${new Date().toLocaleTimeString()}] FATAL CRON ERROR: ${error.message}`);
    console.error("[NightJobScraper] Error:", error);

    try {
      const { db } = await connectToDatabase();
      await db.collection("cron_execution_logs").insertOne({
        type: "fetch_jobs_2am",
        status: "failed",
        timestamp: new Date(),
        summary: error.message,
        details: { stack: error.stack },
      });
    } catch {}

    return {
      success: false,
      dateString,
      rolesProcessed: [],
      totalDiscovered: 0,
      totalMxValid: 0,
      insertedCount: 0,
      logs,
    };
  }
}

/**
 * PHASE 2: Morning 9:00 AM Cron Execution
 * Matches candidate profiles with today's fetched jobs, creates AI personalized pitches,
 * attaches stored PDF resumes, and dispatches outreach emails via their stored refresh tokens.
 */
export async function executeMorningEmailDispatcher(options?: {
  targetDate?: string;
  customerEmail?: string;
  simulateOnly?: boolean;
}): Promise<{
  success: boolean;
  dateString: string;
  totalCustomers: number;
  totalEmailsDispatched: number;
  totalSkipped: number;
  customerReports: any[];
  logs: string[];
}> {
  const logs: string[] = [];
  const dateString = options?.targetDate || getTodayString();
  logs.push(`[${new Date().toLocaleTimeString()}] Starting 9:00 AM Email Dispatcher for Date: ${dateString}`);

  try {
    const { db } = await connectToDatabase();
    const queueCollection = db.collection("daily_jobs_queue");
    const customerCollection = db.collection("customer_profiles");
    const logsCollection = db.collection("cron_execution_logs");
    const dispatchLogsCollection = db.collection("sent_dispatch_logs");

    // 1. Fetch active customer profiles
    let customers = await getActiveCustomerProfiles();
    if (options?.customerEmail) {
      const filterEmail = options.customerEmail.toLowerCase().trim();
      customers = customers.filter((c) => c.email.toLowerCase() === filterEmail);
    }

    logs.push(`[${new Date().toLocaleTimeString()}] Processing ${customers.length} connected active customer profile(s).`);

    if (customers.length === 0) {
      logs.push(`[${new Date().toLocaleTimeString()}] No active customers with connected Gmail accounts found. Skipping dispatch.`);
      return {
        success: true,
        dateString,
        totalCustomers: 0,
        totalEmailsDispatched: 0,
        totalSkipped: 0,
        customerReports: [],
        logs,
      };
    }

    // 2. Fetch jobs from the queue for target date (or recent if queue is empty today for simulation)
    let jobs = await queueCollection
      .find({ dateString })
      .toArray();

    if (jobs.length === 0) {
      logs.push(`[${new Date().toLocaleTimeString()}] No jobs found specifically for date ${dateString}. Fetching recent queue jobs...`);
      jobs = await queueCollection
        .find({})
        .sort({ fetchedAt: -1 })
        .limit(100)
        .toArray();
    }

    logs.push(`[${new Date().toLocaleTimeString()}] Total available jobs in queue: ${jobs.length}`);

    let grandTotalDispatched = 0;
    let grandTotalSkipped = 0;
    const customerReports: any[] = [];

    for (const customer of customers) {
      const customerReport: any = {
        name: customer.name,
        email: customer.email,
        role: customer.role,
        dispatched: 0,
        skipped: 0,
        errors: [],
      };

      logs.push(`----------------------------------------`);
      logs.push(`[${new Date().toLocaleTimeString()}] Candidate: ${customer.name} (${customer.email}) | Target: ${customer.role} | Exp: ${customer.experience}`);

      let sendMethod: "smtp" | "oauth" = "smtp";
      let decryptedAppPassword = "";
      let decryptedRefreshToken = "";

      if (customer.encryptedAppPassword) {
        try {
          decryptedAppPassword = decrypt(customer.encryptedAppPassword);
          sendMethod = "smtp";
        } catch (err: any) {
          logs.push(` -> ❌ Failed to decrypt App Password for ${customer.email}: ${err.message}`);
        }
      }

      if (!decryptedAppPassword && customer.encryptedRefreshToken) {
        try {
          decryptedRefreshToken = decrypt(customer.encryptedRefreshToken);
          sendMethod = "oauth";
        } catch (err: any) {
          logs.push(` -> ❌ Failed to decrypt OAuth token for ${customer.email}: ${err.message}`);
        }
      }

      if (!decryptedAppPassword && !decryptedRefreshToken) {
        logs.push(` -> ⚠️ Neither Google App Password nor OAuth token available for ${customer.email}. Skipping.`);
        customerReport.errors.push("Missing credentials (App Password or OAuth token).");
        customerReports.push(customerReport);
        continue;
      }

      logs.push(` -> 🔑 Dispatch Channel: ${sendMethod === "smtp" ? "⚡ Google App Password (Direct SMTP:465)" : "🌐 Gmail OAuth 2.0 API"}`);

      // Initialize Gmail Client if using OAuth
      let gmail: any = null;
      if (sendMethod === "oauth") {
        const oauthClient = createOAuthClient();
        oauthClient.setCredentials({ refresh_token: decryptedRefreshToken });
        gmail = google.gmail({ version: "v1", auth: oauthClient });
      }

      // Match jobs for this customer
      const candidateRoleWords = (customer.role || "").toLowerCase().split(/\s+/).filter((w) => w.length > 1);
      
      let eligibleJobs: any[] = jobs.filter((job) => {
        // Must not have been dispatched to this customer before
        const alreadyDispatched = Array.isArray(job.dispatchedTo) && job.dispatchedTo.includes(customer.email);
        if (alreadyDispatched) return false;

        // Role keyword match (or general match if no strict keywords)
        const jobText = `${job.role} ${job.snippet} ${job.company}`.toLowerCase();
        const matches = candidateRoleWords.some((w) => jobText.includes(w)) || candidateRoleWords.length === 0;
        return matches;
      });

      const dailyLimit = customer.dailyLimit || 20;

      // If strict role matches are fewer than dailyLimit, pull from remaining un-dispatched queue jobs
      if (eligibleJobs.length < dailyLimit) {
        const remainingJobs = jobs.filter((job) => {
          const alreadyDispatched = Array.isArray(job.dispatchedTo) && job.dispatchedTo.includes(customer.email);
          const alreadyIncluded = eligibleJobs.some((ej) => ej.email === job.email);
          return !alreadyDispatched && !alreadyIncluded;
        });
        eligibleJobs = eligibleJobs.concat(remainingJobs.slice(0, dailyLimit - eligibleJobs.length));
      }

      // If still fewer than dailyLimit, auto-fetch live jobs on the fly in parallel
      if (eligibleJobs.length < dailyLimit && customer.role) {
        logs.push(` -> 🔍 Queue has ${eligibleJobs.length}/${dailyLimit} jobs. Auto-fetching fresh jobs for "${customer.role}" across multi-portals...`);
        try {
          const freshLeads = await searchPublicJobFeeds(customer.role, customer.location || "Remote");
          const candidateLeads = freshLeads.slice(0, 25);
          
          const verifiedLeads = await Promise.allSettled(
            candidateLeads.map(async (item) => {
              const cleanEmail = item.email?.trim().toLowerCase();
              if (!cleanEmail || !isValidEmailFormat(cleanEmail) || isDisposableDomain(cleanEmail)) return null;
              const mxCheck = await verifyEmailMx(cleanEmail);
              if (!mxCheck.valid) return null;
              return { item, cleanEmail, mxCheck };
            })
          );

          let newlyAdded = 0;
          for (const r of verifiedLeads) {
            if (r.status === "fulfilled" && r.value) {
              const { item, cleanEmail, mxCheck } = r.value;
              const newJobDoc: DailyJobQueueItem = {
                dateString,
                email: cleanEmail,
                company: item.company || "Hiring Team",
                role: item.role || customer.role,
                location: item.location || customer.location || "Remote",
                snippet: item.snippet || "",
                sourceUrl: item.sourceUrl || "",
                sourceType: item.sourceType || "live_stream",
                mxValid: true,
                mxDetails: mxCheck.mxRecords?.[0] || "Active MX Host",
                dispatchedTo: [],
                fetchedAt: new Date(),
              };
              try {
                const insertRes = await queueCollection.insertOne(newJobDoc);
                newJobDoc._id = insertRes.insertedId;
                eligibleJobs.push(newJobDoc);
                newlyAdded++;
                if (eligibleJobs.length >= dailyLimit) break;
              } catch {}
            }
          }
          logs.push(` -> ⚡ Discovered and queued ${newlyAdded} new live leads for "${customer.role}". Total ready: ${eligibleJobs.length}`);
        } catch (fetchErr: any) {
          logs.push(` -> ⚠️ On-the-fly lead fetch notice: ${fetchErr.message}`);
        }
      }

      const jobsToProcess = eligibleJobs.slice(0, dailyLimit);
      logs.push(` -> Matched ${eligibleJobs.length} eligible jobs. Processing batch of ${jobsToProcess.length} (Daily Limit: ${dailyLimit}).`);

      // Dispatch outreach emails in concurrent pools of 4
      const CONCURRENCY_CHUNK = 4;
      for (let i = 0; i < jobsToProcess.length; i += CONCURRENCY_CHUNK) {
        const chunk = jobsToProcess.slice(i, i + CONCURRENCY_CHUNK);
        const chunkResults = await Promise.allSettled(
          chunk.map(async (job) => {
            try {
              // Generate AI Pitch
              const pitchRes = await generateAIPersonalizedPitch({
                company: job.company || "your team",
                role: customer.role || job.role || "Software Engineer",
                snippet: job.snippet || "",
                location: customer.location || job.location,
              });

              // Compose Email Subject & Body
              const subject = `Application for ${job.role || customer.role} - ${customer.name} (${customer.experience})`;
              const body = [
                `Hi ${job.company} Hiring Team,`,
                ``,
                `I am writing to express my strong interest in the ${job.role || customer.role} position at ${job.company}.`,
                ``,
                pitchRes.pitch,
                ``,
                `With ${customer.experience} of practical experience, I am confident in my ability to hit the ground running and create immediate impact.`,
                ``,
                `I have attached my updated resume for your review. I would welcome the opportunity to discuss how my skill set aligns with your goals.`,
                ``,
                `Best regards,`,
                `${customer.name}`,
                `${customer.email}`,
              ].join("\n");

              if (options?.simulateOnly) {
                return {
                  success: true,
                  simulated: true,
                  email: job.email,
                  company: job.company,
                  pitch: pitchRes.pitch,
                };
              }

              if (sendMethod === "smtp") {
                // Direct Google SMTP sending using App Password
                const smtpRes = await sendGmailSmtp({
                  fromEmail: customer.email,
                  fromName: customer.name,
                  appPassword: decryptedAppPassword,
                  toEmail: job.email,
                  subject,
                  body,
                  attachmentName: customer.resumeName || "resume.pdf",
                  attachmentMimeType: customer.resumeMimeType || "application/pdf",
                  attachmentBase64: customer.resumeBase64,
                });

                if (!smtpRes.success) {
                  throw new Error(smtpRes.error || "SMTP email delivery failed");
                }
              } else {
                // Build MIME raw email with attached resume if present
                const raw = createRawMimeEmail({
                  to: job.email,
                  fromName: customer.name,
                  fromEmail: customer.email,
                  subject,
                  body,
                  attachmentName: customer.resumeName || "resume.pdf",
                  attachmentMimeType: customer.resumeMimeType || "application/pdf",
                  attachmentBase64: customer.resumeBase64,
                });

                // Send via Gmail OAuth API
                await gmail.users.messages.send({
                  userId: "me",
                  requestBody: { raw },
                });
              }

              // Update daily_jobs_queue to prevent duplicates
              await queueCollection.updateOne(
                { _id: job._id },
                { $addToSet: { dispatchedTo: customer.email } }
              );

              // Update customer sent stats
              await customerCollection.updateOne(
                { email: customer.email },
                {
                  $inc: { totalSentCount: 1 },
                  $set: { lastActiveAt: new Date() },
                }
              );

              // Record dispatch log
              await dispatchLogsCollection.insertOne({
                customerEmail: customer.email,
                customerName: customer.name,
                recipientEmail: job.email,
                company: job.company,
                role: job.role,
                subject,
                aiPitch: pitchRes.pitch,
                dispatchedAt: new Date(),
                dateString,
                status: "sent",
              });

              return {
                success: true,
                simulated: false,
                email: job.email,
                company: job.company,
                pitch: pitchRes.pitch,
              };
            } catch (err: any) {
              return {
                success: false,
                email: job.email,
                error: err.message,
              };
            }
          })
        );

        for (const r of chunkResults) {
          if (r.status === "fulfilled") {
            const res = r.value;
            if (res.success) {
              if (res.simulated) {
                logs.push(` -> [SIMULATION] Would send to ${res.email} (${res.company}) | Pitch: "${res.pitch?.slice(0, 50)}..."`);
              } else {
                logs.push(` -> ✅ Dispatched to ${res.email} (${res.company}) [via ${sendMethod.toUpperCase()}]`);
              }
              customerReport.dispatched++;
              grandTotalDispatched++;
            } else {
              logs.push(` -> ❌ Error dispatching to ${res.email}: ${res.error}`);
              customerReport.errors.push(`${res.email}: ${res.error}`);
              customerReport.skipped++;
              grandTotalSkipped++;
            }
          }
        }
      }

      customerReports.push(customerReport);
    }

    logs.push(`----------------------------------------`);
    logs.push(`[${new Date().toLocaleTimeString()}] Dispatch complete. Total Sent: ${grandTotalDispatched}, Skipped/Failed: ${grandTotalSkipped}`);

    // Record execution log
    await logsCollection.insertOne({
      type: "dispatch_emails_9am",
      status: grandTotalSkipped > 0 && grandTotalDispatched === 0 ? "failed" : "success",
      timestamp: new Date(),
      summary: `Dispatched ${grandTotalDispatched} emails across ${customers.length} customer profiles.`,
      details: {
        dateString,
        totalCustomers: customers.length,
        totalEmailsDispatched: grandTotalDispatched,
        totalSkipped: grandTotalSkipped,
        customerReports,
      },
    });

    return {
      success: true,
      dateString,
      totalCustomers: customers.length,
      totalEmailsDispatched: grandTotalDispatched,
      totalSkipped: grandTotalSkipped,
      customerReports,
      logs,
    };
  } catch (error: any) {
    logs.push(`[${new Date().toLocaleTimeString()}] FATAL CRON DISPATCH ERROR: ${error.message}`);
    console.error("[MorningEmailDispatcher] Error:", error);

    return {
      success: false,
      dateString,
      totalCustomers: 0,
      totalEmailsDispatched: 0,
      totalSkipped: 0,
      customerReports: [],
      logs,
    };
  }
}
