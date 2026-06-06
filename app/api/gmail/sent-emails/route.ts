import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createOAuthClient } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractEmails(value: string) {
  if (!value) return "";

  const matches = value.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  );

  if (!matches) return "";

  return matches.join(", ");
}

function getHeader(headers: any[], name: string) {
  return (
    headers.find(
      (header) => header.name?.toLowerCase() === name.toLowerCase()
    )?.value || ""
  );
}

function formatDate(dateValue: string) {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchMessageWithRetry(gmail: any, id: string, retries = 4, delay = 500): Promise<any> {
  try {
    return await gmail.users.messages.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["To", "From", "Subject", "Date"],
    });
  } catch (err: any) {
    const status = err.status || err.code;
    if (retries > 0 && (status === 429 || status >= 500)) {
      console.warn(`[Gmail API] Error ${status} fetching details for message ${id}. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchMessageWithRetry(gmail, id, retries - 1, delay * 2);
    }
    throw err;
  }
}

export async function GET(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("gmail_refresh_token")?.value;
    const accessToken = req.cookies.get("gmail_access_token")?.value;

    if (!refreshToken && !accessToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Gmail not connected. Please connect Gmail first.",
        },
        { status: 401 }
      );
    }

    const oauth2Client = createOAuthClient();

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 250;
    const startPageToken = searchParams.get("pageToken") || undefined;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let q = "";
    if (startDateParam) {
      q += `after:${startDateParam.replace(/-/g, "/")} `;
    }
    if (endDateParam) {
      try {
        const d = new Date(endDateParam);
        d.setDate(d.getDate() + 1);
        const formattedEnd = d.toISOString().split("T")[0].replace(/-/g, "/");
        q += `before:${formattedEnd} `;
      } catch (e) {
        q += `before:${endDateParam.replace(/-/g, "/")} `;
      }
    }
    q = q.trim();

    let allMessages: any[] = [];
    let pageToken: string | undefined = startPageToken;
    let nextPageToken: string | undefined = undefined;
    let resultSizeEstimate: number | undefined = undefined;

    do {
      const maxToFetch = Math.min(limit - allMessages.length, 500);
      if (maxToFetch <= 0) break;

      const listParams: any = {
        userId: "me",
        labelIds: ["SENT"],
        maxResults: maxToFetch,
        pageToken,
      };

      if (q) {
        listParams.q = q;
      }

      const listResponse: any = await gmail.users.messages.list(listParams);

      const messages = listResponse.data.messages || [];
      allMessages = [...allMessages, ...messages];
      pageToken = listResponse.data.nextPageToken || undefined;
      nextPageToken = pageToken;

      if (resultSizeEstimate === undefined && listResponse.data.resultSizeEstimate !== undefined) {
        resultSizeEstimate = listResponse.data.resultSizeEstimate;
      }

      if (messages.length === 0 || allMessages.length >= limit) {
        break;
      }
    } while (pageToken);

    allMessages = allMessages.slice(0, limit);

    // Fetch details with controlled concurrency to avoid rate limit errors
    const concurrency = 25; // Slightly increased for faster loads but still conservative
    const emails: any[] = [];

    for (let i = 0; i < allMessages.length; i += concurrency) {
      const chunk = allMessages.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(async (message, chunkIdx) => {
          const globalIndex = i + chunkIdx;
          try {
            const msg = await fetchMessageWithRetry(gmail, message.id!);

            const headers = msg.data.payload?.headers || [];
            const rawTo = getHeader(headers, "To");
            const rawFrom = getHeader(headers, "From");
            const rawDate = getHeader(headers, "Date");

            return {
              serialNo: globalIndex + 1,
              id: msg.data.id || "",
              threadId: msg.data.threadId || "",
              to: extractEmails(rawTo),
              from: extractEmails(rawFrom),
              subject: getHeader(headers, "Subject") || "No Subject",
              date: formatDate(rawDate),
              rawDate,
              snippet: msg.data.snippet || "",
            };
          } catch (err) {
            console.error(`Error getting metadata for message ${message.id}:`, err);
            return null;
          }
        })
      );

      emails.push(...chunkResults.filter(Boolean));
    }

    return NextResponse.json({
      success: true,
      count: emails.length,
      nextPageToken: nextPageToken || null,  // Fixed: Added property name
      resultSizeEstimate: resultSizeEstimate || null,
      emails,
    });
  } catch (error: any) {
    console.error("Fetch sent emails error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to fetch sent emails",
      },
      { status: 500 }
    );
  }
}