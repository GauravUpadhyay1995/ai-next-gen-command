import { connectToDatabase } from "./db";
import { getActiveCustomerProfiles, getCustomerResume, CustomerProfile } from "./customer-profile";
import { searchPublicJobFeeds, searchGoogleHiringPosts, DiscoveredLead, isRoleMatch, checkLocationMatch, checkSeniorityMatch } from "./lead-finder";
import { verifyEmailMx, isValidEmailFormat, isDisposableDomain } from "./email-verifier";
import { decrypt } from "./crypto";
import { createOAuthClient } from "./google";
import { google } from "googleapis";
import { generateAIPersonalizedPitch, generateSmartHeuristicPitch } from "./ai-personalizer";
import { sendGmailSmtp, createRawMimeEmailBase64 } from "./smtp-mailer";
import { getSystemSettings } from "./access-control";

export type DailyJobQueueItem = {
  _id?: any;
  dateString: string; // YYYY-MM-DD
  email: string;
  company: string;
  role: string;
  targetRole?: string;
  location: string;
  snippet: string;
  sourceUrl: string;
  sourceType: string;
  postedDate?: string;
  mxValid: boolean;
  mxDetails?: string;
  score?: number;
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

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));


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
      const matchedCust = activeCustomers.find(
        (c) => c.role?.trim().toLowerCase() === role.toLowerCase()
      );
      const roleExp = matchedCust?.experience;
      logs.push(`[${new Date().toLocaleTimeString()}] Fetching jobs for target role: "${role}" (Exp: ${roleExp || "All"})...`);
      for (const loc of targetLocations.slice(0, 2)) {
        try {
          const feedLeads = await searchPublicJobFeeds(role, loc, roleExp);
          const taggedLeads = feedLeads.map((l) => ({ ...l, targetRole: role } as DiscoveredLead & { targetRole: string }));
          logs.push(` -> Public feeds returned ${feedLeads.length} leads for "${role}" (${loc})`);
          allDiscovered = allDiscovered.concat(taggedLeads);
        } catch (err: any) {
          logs.push(` -> Feed fetch error for "${role}": ${err.message}`);
        }

        // Also query Google Intent search if configured
        if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
          try {
            const googleLeads = await searchGoogleHiringPosts(role, loc);
            const taggedGoogle = googleLeads.map((l) => ({ ...l, targetRole: role } as DiscoveredLead & { targetRole: string }));
            logs.push(` -> Google hiring posts returned ${googleLeads.length} leads for "${role}"`);
            allDiscovered = allDiscovered.concat(taggedGoogle);
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

    // Verify MX Records in fast parallel batches with deep zero-send SMTP ping
    const candidatePool = uniqueLeads.slice(0, 50);
    const mxCheckResults = await Promise.allSettled(
      candidatePool.map(async (lead) => {
        const mxCheck = await verifyEmailMx(lead.email, true);
        if (mxCheck.valid) {
          return {
            ...lead,
            mxValid: true,
            mxDetails: mxCheck.smtpStatus || mxCheck.mxRecords?.[0] || "Active MX Host",
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
        targetRole: (lead as any).targetRole || lead.role || "Target Role",
        location: lead.location || "Remote",
        snippet: lead.snippet || "",
        sourceUrl: lead.sourceUrl || "",
        sourceType: lead.sourceType || "public_feed",
        postedDate: lead.postedDate || new Date().toLocaleDateString(),
        mxValid: true,
        mxDetails: lead.mxDetails,
        score: lead.score || 75,
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
 * Helper to generate diverse natural subject lines to prevent robotic spam patterns.
 */
function getDynamicEmailSubject(role: string, name: string, experience: string, company: string, idx: number): string {
  const cleanComp = company && company !== "Hiring Team" ? ` at ${company}` : "";
  const templates = [
    `Application for ${role}${cleanComp} - ${name} (${experience})`,
    `${name} - Application for ${role} Opening`,
    `Exploring ${role} Role${cleanComp} | ${name} (${experience})`,
    `Application: ${role} - ${name}`,
    `Experienced ${role} (${experience}) - ${name}`,
  ];
  return templates[idx % templates.length];
}

/**
 * Helper to generate diverse natural salutations.
 */
function getDynamicSalutation(company: string, idx: number): string {
  if (company && company !== "Hiring Team") {
    const list = [
      `Hi ${company} Hiring Team,`,
      `Hello ${company} Team,`,
      `Dear ${company} Hiring Manager,`,
      `Greetings ${company} Team,`,
    ];
    return list[idx % list.length];
  }
  return "Hi Hiring Team,";
}

/**
 * PHASE 2: Morning 9:00 AM Cron Execution
 * Matches candidate profiles with today's fetched jobs, creates AI personalized pitches,
 * attaches stored PDF resumes, and dispatches outreach emails via their stored refresh tokens.
 * Features:
 * - Anti-Recruiter Fatigue: Domain throttling prevents multiple candidates from emailing the same company on the same day.
 * - Anti-Spam: Dynamic subjects, diverse salutations, and polite opt-out footer.
 * - Warm-Up Guard: Caps new accounts to safe velocity to protect Gmail reputation.
 * - Serverless Timeout Guard: Processes in safe chunk batches.
 */
export async function executeMorningEmailDispatcher(options?: {
  targetDate?: string;
  customerEmail?: string;
  simulateOnly?: boolean;
  batchLimit?: number;
}): Promise<{
  success: boolean;
  dateString: string;
  totalCustomers: number;
  totalEmailsDispatched: number;
  totalSkipped: number;
  customerReports: any[];
  hasMorePending: boolean;
  remainingQueueJobs: number;
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

    // 1. Fetch active customer profiles (lightweight without heavy base64 resumes)
    let customers = await getActiveCustomerProfiles({ includeResumeBase64: false });
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
        hasMorePending: false,
        remainingQueueJobs: 0,
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

    // Recruiter Domain & Company Throttling: Prevent multiple candidates from emailing the same company on the same day
    const dispatchedCompanyDomainsToday = new Set<string>();
    try {
      const priorLogs = await dispatchLogsCollection
        .find({ dateString })
        .project({ company: 1, recipientEmail: 1 })
        .toArray();

      for (const pl of priorLogs) {
        if (pl.company && pl.company !== "Hiring Team") {
          dispatchedCompanyDomainsToday.add(pl.company.toLowerCase().trim());
        }
        if (pl.recipientEmail) {
          const domain = pl.recipientEmail.split("@")[1]?.toLowerCase().trim();
          if (domain && !["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "protonmail.com"].includes(domain)) {
            dispatchedCompanyDomainsToday.add(domain);
          }
        }
      }
    } catch {}

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
      let activeAppPassword = customer.appPassword || "";
      if (!activeAppPassword && customer.encryptedAppPassword) {
        if (customer.encryptedAppPassword.includes(":")) {
          try {
            activeAppPassword = decrypt(customer.encryptedAppPassword);
          } catch (err: any) {
            activeAppPassword = customer.encryptedAppPassword;
          }
        } else {
          activeAppPassword = customer.encryptedAppPassword;
        }
      }

      if (activeAppPassword) {
        sendMethod = "smtp";
      }

      let decryptedRefreshToken = "";
      if (!activeAppPassword && customer.encryptedRefreshToken) {
        try {
          decryptedRefreshToken = decrypt(customer.encryptedRefreshToken);
          sendMethod = "oauth";
        } catch (err: any) {
          logs.push(` -> ❌ Failed to decrypt OAuth token for ${customer.email}: ${err.message}`);
        }
      }

      if (!activeAppPassword && !decryptedRefreshToken) {
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

      // Load candidate resume on-demand (lightweight, zero memory bloat)
      let resumeData: { resumeName?: string; resumeMimeType?: string; resumeBase64?: string } | null = null;
      if (customer.resumeBase64) {
        resumeData = {
          resumeName: customer.resumeName || "resume.pdf",
          resumeMimeType: customer.resumeMimeType || "application/pdf",
          resumeBase64: customer.resumeBase64,
        };
      } else {
        resumeData = await getCustomerResume(customer.email);
      }

      // Match jobs strictly for this customer's target role and location
      let eligibleJobs: any[] = jobs.filter((job) => {
        // Must not have been dispatched to this customer before
        const alreadyDispatched = Array.isArray(job.dispatchedTo) && job.dispatchedTo.includes(customer.email);
        if (alreadyDispatched) return false;

        // Recruiter Overlap Protection: Skip if another candidate already contacted this company or domain today
        const compKey = (job.company || "").toLowerCase().trim();
        const recipDomain = (job.email || "").split("@")[1]?.toLowerCase().trim();
        const isCommonEmailProvider = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "protonmail.com"].includes(recipDomain);

        if (compKey && compKey !== "hiring team" && dispatchedCompanyDomainsToday.has(compKey)) {
          return false;
        }
        if (recipDomain && !isCommonEmailProvider && dispatchedCompanyDomainsToday.has(recipDomain)) {
          return false;
        }

        // Role match: check job.targetRole or isRoleMatch
        const roleMatches =
          (job.targetRole && job.targetRole.toLowerCase() === customer.role.toLowerCase()) ||
          isRoleMatch(job.role, job.snippet || "", customer.role);
        if (!roleMatches) return false;

        // Seniority / Experience fitment
        if (!checkSeniorityMatch(job.role, customer.experience)) {
          return false;
        }

        // Location match
        const locationMatches = checkLocationMatch(job.location || "Remote", job.snippet || "", customer.location || "Remote");
        return locationMatches;
      });

      // Sort eligible jobs by lead quality score descending so top-rated leads are prioritized
      eligibleJobs.sort((a, b) => (b.score || 70) - (a.score || 70));

      // Safe Account Warm-Up Safeguard:
      // If customer is brand new (totalSentCount < 10), cap daily batch to max 5 emails for the first few days
      let effectiveLimit = customer.dailyLimit || 20;
      if (!customer.totalSentCount || customer.totalSentCount < 10) {
        effectiveLimit = Math.min(effectiveLimit, 5);
        logs.push(` -> 🛡️ Safe Warm-Up Guard: Candidate is newly connected (${customer.totalSentCount || 0} sent so far). Capping to ${effectiveLimit} emails today.`);
      }

      // Safe Serverless Batch Limit: default max 5 emails per execution to avoid 60s gateway timeouts
      const maxBatchPerRun = options?.batchLimit && options.batchLimit > 0 ? options.batchLimit : 5;
      const jobsToProcess = eligibleJobs.slice(0, Math.min(effectiveLimit, maxBatchPerRun));

      logs.push(` -> Matched ${eligibleJobs.length} eligible jobs. Processing batch of ${jobsToProcess.length} (Effective Limit: ${effectiveLimit}, Batch Cap: ${maxBatchPerRun}).`);

      // Fetch SuperAdmin Rate Limiting Settings
      const systemSettings = await getSystemSettings();
      const emailsPerMin = systemSettings.emailsPerMinute && systemSettings.emailsPerMinute > 0
        ? systemSettings.emailsPerMinute
        : 10;
      // Delay in ms: e.g. 1 mail/min = 60,000ms, 2 mails/min = 30,000ms, etc.
      const delayBetweenEmailsMs = Math.max(1000, Math.round((60 / emailsPerMin) * 1000));
      logs.push(` -> ⏱️ Pacing Config: ${emailsPerMin} mail/min (${Math.round(delayBetweenEmailsMs / 1000)}s interval between consecutive emails)`);

      // Sequentially dispatch outreach emails according to configured rate limit
      for (let j = 0; j < jobsToProcess.length; j++) {
        const job = jobsToProcess[j];
        const emailIndex = j + 1;

        try {
          // Generate AI Pitch
          const pitchRes = await generateAIPersonalizedPitch({
            company: job.company || "your team",
            role: customer.role || job.role || "Software Engineer",
            snippet: job.snippet || "",
            location: customer.location || job.location,
          });

          // Compose Dynamic Anti-Spam Email Subject & Body
          const subject = getDynamicEmailSubject(job.role || customer.role, customer.name, customer.experience, job.company, j);
          const salutation = getDynamicSalutation(job.company, j);

          const body = [
            salutation,
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
            ``,
            `---`,
            `P.S. If your team is not actively hiring or if you prefer not to receive applications, please reply with "not hiring" and I will ensure you are removed from future outreach.`,
          ].join("\n");

          if (options?.simulateOnly) {
            logs.push(` -> [SIMULATION #${emailIndex}/${jobsToProcess.length}] Would send to ${job.email} (${job.company}) | Subject: "${subject}" | Pitch: "${pitchRes.pitch?.slice(0, 45)}..."`);
            customerReport.dispatched++;
            grandTotalDispatched++;
          } else {
            if (sendMethod === "smtp") {
              // Direct Google SMTP sending using App Password with pre-flight MX check
              const smtpRes = await sendGmailSmtp({
                fromEmail: customer.email,
                fromName: customer.name,
                appPassword: activeAppPassword,
                toEmail: job.email,
                subject,
                body,
                attachmentName: resumeData?.resumeName || "resume.pdf",
                attachmentMimeType: resumeData?.resumeMimeType || "application/pdf",
                attachmentBase64: resumeData?.resumeBase64,
              });

              if (!smtpRes.success) {
                throw new Error(smtpRes.error || "SMTP email delivery failed");
              }
            } else {
              // Build RFC-5322 MIME raw email with attached resume if present
              const raw = createRawMimeEmailBase64({
                toEmail: job.email,
                fromName: customer.name,
                fromEmail: customer.email,
                subject,
                body,
                attachmentName: resumeData?.resumeName || "resume.pdf",
                attachmentMimeType: resumeData?.resumeMimeType || "application/pdf",
                attachmentBase64: resumeData?.resumeBase64,
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

            // Lock company & domain for today so no other candidate contacts them
            const compKey = (job.company || "").toLowerCase().trim();
            const recipDomain = (job.email || "").split("@")[1]?.toLowerCase().trim();
            const isCommonEmailProvider = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "protonmail.com"].includes(recipDomain);
            if (compKey && compKey !== "hiring team") {
              dispatchedCompanyDomainsToday.add(compKey);
            }
            if (recipDomain && !isCommonEmailProvider) {
              dispatchedCompanyDomainsToday.add(recipDomain);
            }

            customerReport.dispatched++;
            grandTotalDispatched++;
            logs.push(` -> ✅ [${emailIndex}/${jobsToProcess.length}] Dispatched to ${job.email} (${job.company}) [via ${sendMethod.toUpperCase()}]`);
          }
        } catch (err: any) {
          logs.push(` -> ❌ [${emailIndex}/${jobsToProcess.length}] Error dispatching to ${job.email}: ${err.message}`);
          customerReport.errors.push(`${job.email}: ${err.message}`);
          customerReport.skipped++;
          grandTotalSkipped++;
        }

        // Pacing delay between consecutive emails according to configured rate limit
        if (j < jobsToProcess.length - 1 && !options?.simulateOnly) {
          logs.push(` -> ⏳ [Pacing Rate: ${emailsPerMin} mail/min] Waiting ${Math.round(delayBetweenEmailsMs / 1000)}s before sending next email...`);
          await sleep(delayBetweenEmailsMs);
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

    const totalRemaining = jobs.filter((j) => !j.dispatchedTo || j.dispatchedTo.length === 0).length;

    return {
      success: true,
      dateString,
      totalCustomers: customers.length,
      totalEmailsDispatched: grandTotalDispatched,
      totalSkipped: grandTotalSkipped,
      customerReports,
      hasMorePending: totalRemaining > 0,
      remainingQueueJobs: totalRemaining,
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
      hasMorePending: false,
      remainingQueueJobs: 0,
      logs,
    };
  }
}
