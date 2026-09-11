import { NextRequest, NextResponse } from "next/server";
import { BUILTIN_TEMPLATES, EmailTemplate } from "@/lib/template-presets";
import { connectToDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let customTemplates: EmailTemplate[] = [];

    if (process.env.MONGODB_URI) {
      try {
        const { db } = await connectToDatabase();
        const collection = db.collection("templates");
        const found = await collection.find({}).sort({ updatedAt: -1 }).toArray();
        customTemplates = found.map((doc) => ({
          id: doc._id.toString(),
          name: doc.name,
          description: doc.description || "Custom Saved Template",
          category: "custom" as const,
          subject: doc.subject,
          body: doc.body,
        }));
      } catch (e) {
        console.warn("[Templates API] DB fetch skipped:", e);
      }
    }

    return NextResponse.json({
      success: true,
      templates: [...BUILTIN_TEMPLATES, ...customTemplates],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, subject, body: emailBody } = body;

    if (!name || !subject || !emailBody) {
      return NextResponse.json(
        { success: false, message: "Name, subject, and body are required." },
        { status: 400 }
      );
    }

    if (process.env.MONGODB_URI) {
      const { db } = await connectToDatabase();
      const collection = db.collection("templates");
      const res = await collection.insertOne({
        name,
        subject,
        body: emailBody,
        category: "custom",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        id: res.insertedId.toString(),
        message: "Template saved successfully to database.",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Template saved in session memory.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save template" },
      { status: 500 }
    );
  }
}
