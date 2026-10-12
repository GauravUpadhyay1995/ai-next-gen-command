import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Normalizes platform/source string into a user-friendly category.
 */
function normalizePlatform(sourceType?: string, sourceUrl?: string): string {
  const src = (sourceType || "").toLowerCase();
  const url = (sourceUrl || "").toLowerCase();

  if (src.includes("linkedin") || url.includes("linkedin.com")) return "LinkedIn";
  if (src.includes("indeed") || url.includes("indeed.com") || url.includes("indeed.co.in")) return "Indeed";
  if (src.includes("naukri") || url.includes("naukri.com")) return "Naukri";
  if (src.includes("glassdoor") || url.includes("glassdoor.com")) return "Glassdoor";
  if (src.includes("google") || url.includes("google.com")) return "Google Jobs";
  if (src.includes("company_career") || src.includes("career") || url.includes("/career") || url.includes("/jobs")) return "Company Career";
  if (src.includes("b2b") || src.includes("directory") || src.includes("maps")) return "B2B Directory";
  if (src.includes("public_feed") || src.includes("feed") || src.includes("live_stream")) return "Job Boards";
  return sourceType ? sourceType.charAt(0).toUpperCase() + sourceType.slice(1) : "Direct Lead";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const location = (searchParams.get("location") || "").trim();
    const role = (searchParams.get("role") || "").trim();
    const experience = (searchParams.get("experience") || "").trim();
    const platform = (searchParams.get("platform") || "").trim();
    const status = (searchParams.get("status") || "").trim();
    const search = (searchParams.get("search") || "").trim();
    const sortBy = searchParams.get("sortBy") || "updatedAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    const { db } = await connectToDatabase();
    const leadsCollection = db.collection("leads");

    // Build MongoDB query filter
    const query: any = {};

    // 1. Location Filter
    if (location && location.toLowerCase() !== "all") {
      query.location = { $regex: new RegExp(location, "i") };
    }

    // 2. Role Filter
    if (role && role.toLowerCase() !== "all") {
      query.role = { $regex: new RegExp(role, "i") };
    }

    // 3. Experience Filter
    if (experience && experience.toLowerCase() !== "all") {
      const expRegex = new RegExp(experience.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), "i");
      query.$or = [
        { experience: { $regex: expRegex } },
        { snippet: { $regex: expRegex } },
        { role: { $regex: expRegex } },
      ];
    }

    // 4. Platform / Source Filter
    if (platform && platform.toLowerCase() !== "all") {
      const platLower = platform.toLowerCase();
      if (platLower === "linkedin") {
        query.$or = [{ sourceType: { $regex: /linkedin/i } }, { sourceUrl: { $regex: /linkedin\.com/i } }];
      } else if (platLower === "indeed") {
        query.$or = [{ sourceType: { $regex: /indeed/i } }, { sourceUrl: { $regex: /indeed\./i } }];
      } else if (platLower === "naukri") {
        query.$or = [{ sourceType: { $regex: /naukri/i } }, { sourceUrl: { $regex: /naukri\.com/i } }];
      } else if (platLower === "glassdoor") {
        query.$or = [{ sourceType: { $regex: /glassdoor/i } }, { sourceUrl: { $regex: /glassdoor\.com/i } }];
      } else if (platLower === "google" || platLower === "google jobs") {
        query.$or = [{ sourceType: { $regex: /google/i } }, { sourceUrl: { $regex: /google\./i } }];
      } else if (platLower === "company career") {
        query.$or = [{ sourceType: { $regex: /company_career/i } }, { sourceUrl: { $regex: /career|jobs/i } }];
      } else if (platLower === "b2b") {
        query.$or = [{ sourceType: { $regex: /b2b/i } }, { leadType: "b2b" }];
      } else {
        query.$or = [
          { sourceType: { $regex: new RegExp(platform, "i") } },
          { sourceUrl: { $regex: new RegExp(platform, "i") } },
        ];
      }
    }

    // 5. Status Filter
    if (status && status.toLowerCase() !== "all") {
      if (status === "contacted") {
        query.status = "contacted";
      } else if (status === "discovered" || status === "uncontacted") {
        query.$or = [{ status: "discovered" }, { status: { $exists: false } }, { status: { $ne: "contacted" } }];
      } else if (status === "verified") {
        query.mxValid = true;
      } else {
        query.status = status;
      }
    }

    // 6. Global Search Query
    if (search) {
      const searchRegex = new RegExp(search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), "i");
      const searchConditions = [
        { email: { $regex: searchRegex } },
        { company: { $regex: searchRegex } },
        { role: { $regex: searchRegex } },
        { location: { $regex: searchRegex } },
        { name: { $regex: searchRegex } },
        { snippet: { $regex: searchRegex } },
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    // Sort definition
    const sortFieldMap: Record<string, string> = {
      updatedAt: "updatedAt",
      createdAt: "createdAt",
      company: "company",
      role: "role",
      email: "email",
      lastContactedAt: "lastContactedAt",
    };
    const sortKey = sortFieldMap[sortBy] || "updatedAt";

    // Query DB with pagination
    const skip = (page - 1) * limit;
    const [rawLeads, totalCount, totalInDb, contactedCount, verifiedCount] = await Promise.all([
      leadsCollection.find(query).sort({ [sortKey]: sortOrder }).skip(skip).limit(limit).toArray(),
      leadsCollection.countDocuments(query),
      leadsCollection.countDocuments({}),
      leadsCollection.countDocuments({ status: "contacted" }),
      leadsCollection.countDocuments({ mxValid: true }),
    ]);

    // Format leads for response
    const leads = rawLeads.map((doc) => {
      const p = normalizePlatform(doc.sourceType, doc.sourceUrl);
      return {
        _id: doc._id.toString(),
        email: doc.email,
        name: doc.name || "",
        company: doc.company || "Hiring Team",
        role: doc.role || "Open Position",
        location: doc.location || "Remote",
        experience: doc.experience || "Not specified",
        snippet: doc.snippet || "",
        sourceUrl: doc.sourceUrl || "",
        sourceType: doc.sourceType || "direct",
        platform: p,
        status: doc.status || "discovered",
        mxValid: doc.mxValid !== false,
        mxDetails: doc.mxDetails || "",
        leadType: doc.leadType || "job",
        dispatchedTo: doc.dispatchedTo || [],
        lastContactedAt: doc.lastContactedAt || null,
        createdAt: doc.createdAt || null,
        updatedAt: doc.updatedAt || null,
      };
    });

    // Extract quick metadata for filter dropdown suggestions
    const topLocations = await leadsCollection.distinct("location", {});
    const topRoles = await leadsCollection.distinct("role", {});

    return NextResponse.json({
      success: true,
      leads,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
      summary: {
        totalInDb,
        matchingFilter: totalCount,
        contactedCount,
        discoveredCount: totalInDb - contactedCount,
        verifiedCount,
        availableLocations: topLocations.filter(Boolean).slice(0, 40),
        availableRoles: topRoles.filter(Boolean).slice(0, 40),
      },
    });
  } catch (error: any) {
    console.error("[Admin Leads API] GET error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch database leads" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, emails, id } = body;

    const { db } = await connectToDatabase();
    const leadsCollection = db.collection("leads");

    if (id) {
      const res = await leadsCollection.deleteOne({ _id: new ObjectId(id) });
      return NextResponse.json({ success: res.deletedCount > 0, message: "Lead removed." });
    }

    if (Array.isArray(emails) && emails.length > 0) {
      const cleanEmails = emails.map((e) => String(e).toLowerCase().trim());
      const res = await leadsCollection.deleteMany({ email: { $in: cleanEmails } });
      return NextResponse.json({
        success: true,
        deletedCount: res.deletedCount,
        message: `${res.deletedCount} leads removed from database.`,
      });
    }

    if (email) {
      const res = await leadsCollection.deleteOne({ email: String(email).toLowerCase().trim() });
      return NextResponse.json({ success: res.deletedCount > 0, message: `Lead ${email} removed.` });
    }

    return NextResponse.json({ success: false, message: "No email or ID provided for deletion." }, { status: 400 });
  } catch (error: any) {
    console.error("[Admin Leads API] DELETE error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete lead(s)" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, emails, status, mxValid } = body;

    if (!email && (!Array.isArray(emails) || emails.length === 0)) {
      return NextResponse.json({ success: false, message: "Email(s) required." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const leadsCollection = db.collection("leads");

    const updateDoc: any = { updatedAt: new Date() };
    if (status !== undefined) updateDoc.status = status;
    if (mxValid !== undefined) updateDoc.mxValid = Boolean(mxValid);

    if (Array.isArray(emails) && emails.length > 0) {
      const cleanEmails = emails.map((e) => String(e).toLowerCase().trim());
      const res = await leadsCollection.updateMany({ email: { $in: cleanEmails } }, { $set: updateDoc });
      return NextResponse.json({
        success: true,
        modifiedCount: res.modifiedCount,
        message: `${res.modifiedCount} leads updated.`,
      });
    }

    if (email) {
      const res = await leadsCollection.updateOne(
        { email: String(email).toLowerCase().trim() },
        { $set: updateDoc }
      );
      return NextResponse.json({ success: res.modifiedCount > 0, message: "Lead updated." });
    }

    return NextResponse.json({ success: false, message: "Update failed." }, { status: 400 });
  } catch (error: any) {
    console.error("[Admin Leads API] PATCH error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update lead status" },
      { status: 500 }
    );
  }
}
