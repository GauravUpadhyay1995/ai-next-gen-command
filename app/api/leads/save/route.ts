import { NextRequest, NextResponse } from "next/server";
import { getSavedLeads, saveLeads, updateLeadStatus } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const leads = await getSavedLeads(200);
    return NextResponse.json({
      success: true,
      count: leads.length,
      leads,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch saved leads" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === "update_status" && body.email && body.status) {
      const updated = await updateLeadStatus(body.email, body.status);
      return NextResponse.json({ success: updated });
    }

    const leads = Array.isArray(body.leads) ? body.leads : [];
    const { savedCount } = await saveLeads(leads);
    return NextResponse.json({ success: true, savedCount });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save leads" },
      { status: 500 }
    );
  }
}
