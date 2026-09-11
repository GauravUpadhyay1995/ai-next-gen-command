import { NextRequest, NextResponse } from "next/server";
import { generateAIPersonalizedPitch } from "@/lib/ai-personalizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company, role, category, snippet, location, pitchType, apiKey } = body;

    if (!company && !role && !category) {
      return NextResponse.json(
        { success: false, message: "Company, category, or role is required for personalization." },
        { status: 400 }
      );
    }

    const result = await generateAIPersonalizedPitch(
      {
        company: company || "Valued Team",
        role: role || (category ? `${category} Team` : "Open Role"),
        category: category || "",
        snippet: snippet || "",
        location: location || "",
        pitchType: pitchType || (category ? "b2b_sales" : "job_application"),
      },
      apiKey
    );

    return NextResponse.json({
      success: true,
      pitch: result.pitch,
      source: result.source,
    });
  } catch (error: any) {
    console.error("[AI Personalize API] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to generate pitch" },
      { status: 500 }
    );
  }
}
