import { NextRequest, NextResponse } from "next/server";
import {
  createCustomerProfile,
  getAllCustomerProfiles,
  updateCustomerStatus,
  updateCustomerAppPassword,
  updateCustomerProfile,
  deleteCustomerProfile,
} from "@/lib/customer-profile";
import { connectToDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const customers = await getAllCustomerProfiles();
    
    // Also fetch high-level queue stats
    let todayQueuedJobs = 0;
    try {
      const { db } = await connectToDatabase();
      const todayStr = new Date().toISOString().split("T")[0];
      todayQueuedJobs = await db.collection("daily_jobs_queue").countDocuments({ dateString: todayStr });
    } catch {}

    return NextResponse.json({
      success: true,
      customers,
      stats: {
        totalCustomers: customers.length,
        activeCustomers: customers.filter((c) => c.status === "active").length,
        pendingAuthCustomers: customers.filter((c) => c.status === "pending_auth").length,
        todayQueuedJobs,
      },
    });
  } catch (error: any) {
    console.error("[Customers API] GET error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch customer profiles" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").toLowerCase().trim();
    const role = String(formData.get("role") || "Software Engineer").trim();
    const experience = String(formData.get("experience") || "1-3 Years").trim();
    const location = String(formData.get("location") || "Remote").trim();
    const dailyLimit = Number(formData.get("dailyLimit")) || 20;
    const customerCategory = (String(formData.get("customerCategory") || "job_seeker")) as "job_seeker" | "b2b_lead_finder" | "all";
    const googleAppPassword = String(formData.get("googleAppPassword") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const resumeFile = formData.get("resume") as File | null;

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Customer email is required" },
        { status: 400 }
      );
    }

    let resumeBase64: string | undefined;
    let resumeName: string | undefined;
    let resumeMimeType: string | undefined;

    if (resumeFile && typeof resumeFile.arrayBuffer === "function") {
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      resumeBase64 = buffer.toString("base64");
      resumeName = resumeFile.name || "resume.pdf";
      resumeMimeType = resumeFile.type || "application/pdf";
    }

    const result = await createCustomerProfile({
      name: name || email.split("@")[0],
      email,
      role,
      experience,
      location,
      dailyLimit,
      customerCategory,
      googleAppPassword,
      resumeName,
      resumeBase64,
      resumeMimeType,
      notes,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    const isInstantActive = !!googleAppPassword;
    return NextResponse.json({
      success: true,
      message: isInstantActive
        ? `Candidate profile created & activated with Google App Password! Autopilot email dispatch is ready.`
        : `Candidate profile created for ${email}. Share the 1-time onboarding link to activate Gmail sending.`,
      profile: result.profile,
      customer: result.profile,
    });
  } catch (error: any) {
    console.error("[Customers API] POST error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save customer profile" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const email = String(formData.get("email") || "").toLowerCase().trim();

      if (!email) {
        return NextResponse.json(
          { success: false, message: "Candidate email is required" },
          { status: 400 }
        );
      }

      const name = formData.get("name") !== null ? String(formData.get("name")).trim() : undefined;
      const role = formData.get("role") !== null ? String(formData.get("role")).trim() : undefined;
      const experience = formData.get("experience") !== null ? String(formData.get("experience")).trim() : undefined;
      const location = formData.get("location") !== null ? String(formData.get("location")).trim() : undefined;
      const dailyLimit = formData.get("dailyLimit") !== null ? Number(formData.get("dailyLimit")) : undefined;
      const customerCategory = formData.get("customerCategory") !== null ? (String(formData.get("customerCategory")) as any) : undefined;
      const googleAppPassword = formData.get("googleAppPassword") !== null ? String(formData.get("googleAppPassword")).trim() : undefined;
      const notes = formData.get("notes") !== null ? String(formData.get("notes")).trim() : undefined;
      const status = formData.get("status") !== null ? (String(formData.get("status")) as any) : undefined;
      const resumeFile = formData.get("resume") as File | null;

      let resumeBase64: string | undefined;
      let resumeName: string | undefined;
      let resumeMimeType: string | undefined;

      if (resumeFile && typeof resumeFile.arrayBuffer === "function" && resumeFile.size > 0) {
        const buffer = Buffer.from(await resumeFile.arrayBuffer());
        resumeBase64 = buffer.toString("base64");
        resumeName = resumeFile.name || "resume.pdf";
        resumeMimeType = resumeFile.type || "application/pdf";
      }

      const result = await updateCustomerProfile({
        email,
        name,
        role,
        experience,
        location,
        dailyLimit,
        customerCategory,
        googleAppPassword,
        resumeName,
        resumeBase64,
        resumeMimeType,
        notes,
        status,
      });

      if (!result.success) {
        return NextResponse.json({ success: false, message: result.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        profile: result.profile,
        customer: result.profile,
      });
    }

    // Handle application/json payloads
    const body = await req.json();
    const {
      email,
      name,
      role,
      experience,
      location,
      dailyLimit,
      customerCategory,
      googleAppPassword,
      appPassword,
      notes,
      status,
    } = body;

    const cleanEmail = String(email || "").toLowerCase().trim();
    if (!cleanEmail) {
      return NextResponse.json(
        { success: false, message: "Candidate email is required" },
        { status: 400 }
      );
    }

    // Direct password update
    if (appPassword !== undefined && Object.keys(body).length <= 2) {
      const updated = await updateCustomerAppPassword(cleanEmail, appPassword);
      if (!updated) {
        return NextResponse.json(
          { success: false, message: "Candidate not found or password update failed" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: `Candidate ${cleanEmail} app password updated in raw format`,
      });
    }

    // Direct status update
    if (status && Object.keys(body).length <= 2 && !name && !role) {
      const updated = await updateCustomerStatus(cleanEmail, status);
      if (!updated) {
        return NextResponse.json(
          { success: false, message: "Customer not found or status unchanged" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: `Customer ${cleanEmail} status updated to ${status}`,
      });
    }

    const result = await updateCustomerProfile({
      email: cleanEmail,
      name,
      role,
      experience,
      location,
      dailyLimit: dailyLimit !== undefined ? Number(dailyLimit) : undefined,
      customerCategory,
      googleAppPassword: googleAppPassword || appPassword,
      notes,
      status,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      profile: result.profile,
      customer: result.profile,
    });
  } catch (error: any) {
    console.error("[Customers API] PUT error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update customer" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Customer email is required" },
        { status: 400 }
      );
    }

    const deleted = await deleteCustomerProfile(email);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Customer not found or delete failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Customer profile for ${email} deleted successfully`,
    });
  } catch (error: any) {
    console.error("[Customers API] DELETE error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete customer profile" },
      { status: 500 }
    );
  }
}
