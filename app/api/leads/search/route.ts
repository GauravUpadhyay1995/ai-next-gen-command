import { NextRequest, NextResponse } from "next/server";
import {
  searchPublicJobFeeds,
  searchGoogleHiringPosts,
  scanCompanyCareerSection,
  searchB2BBusinessLeads,
  DiscoveredLead,
} from "@/lib/lead-finder";
import { saveLeads } from "@/lib/db";
import { loadOwnerToken } from "@/lib/token-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("gmail_refresh_token")?.value;
    const accessToken = req.cookies.get("gmail_access_token")?.value;
    const ownerTokenData = await loadOwnerToken();

    // 🔒 Security Guard: Lead Finder requires active Google OAuth authentication
    if (!refreshToken && !accessToken && !ownerTokenData) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          message: "Unauthorized. Please authenticate your Google account to access Lead Finder.",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "job_seeker"; // "job_seeker" | "b2b_lead_finder"
    const keyword = searchParams.get("keyword") || "";
    const category = searchParams.get("category") || keyword;
    const location = searchParams.get("location") || "";
    const company = searchParams.get("company") || "";
    const source = searchParams.get("source") || "all"; // "all" | "public_feed" | "company_career" | "google"
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const limit = parseInt(searchParams.get("limit") || "80", 10) || 80;
    const googleApiKey = searchParams.get("googleApiKey") || undefined;
    const googleCx = searchParams.get("googleCx") || undefined;

    let leads: DiscoveredLead[] = [];

    // =====================================
    // 🏢 B2B BUSINESS & DIRECTORY DISCOVERY
    // =====================================
    if (mode === "b2b_lead_finder") {
      const b2bLeads = await searchB2BBusinessLeads({
        category: category || "Business",
        location: location || "India",
        limit: Math.min(limit, 200),
        page,
      });
      leads.push(...b2bLeads);
    } else {
      // =====================================
      // 🧑‍💻 JOB SEEKER / CAREER FEEDS SEARCH
      // =====================================
      // 1. Direct Company Career Scan (if specified or if source is company_career)
      if (company || source === "company_career") {
        const targetCompany = company || keyword;
        if (targetCompany) {
          const careerLeads = await scanCompanyCareerSection(targetCompany, keyword, location);
          leads.push(...careerLeads);
        }
      }

      // 2. Multi-Feed Search
      if (source === "all" || source === "public_feed") {
        const feedLeads = await searchPublicJobFeeds(keyword || "developer", location);
        leads.push(...feedLeads);
      }

      // 3. Optional Google Search
      if (source === "all" || source === "google") {
        const googleLeads = await searchGoogleHiringPosts(keyword || "developer", location, googleApiKey, googleCx);
        leads.push(...googleLeads);
      }
    }

    // Deduplicate by email
    const uniqueMap = new Map<string, DiscoveredLead>();
    for (const lead of leads) {
      if (!uniqueMap.has(lead.email)) {
        uniqueMap.set(lead.email, lead);
      }
    }

    const uniqueLeads = Array.from(uniqueMap.values());

    // Optionally save to DB if Mongo is configured
    if (uniqueLeads.length > 0 && process.env.MONGODB_URI) {
      try {
        await saveLeads(uniqueLeads);
      } catch (e) {
        console.warn("[Leads Search API] DB auto-save skipped:", e);
      }
    }

    return NextResponse.json({
      success: true,
      count: uniqueLeads.length,
      page,
      limit,
      keyword,
      location,
      leads: uniqueLeads,
    });
  } catch (error: any) {
    console.error("[Leads Search API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to discover hiring leads",
      },
      { status: 500 }
    );
  }
}
