import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET() {
  const filePath = path.join(process.cwd(), "SAMPLE.xlsx");

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Sample file not found", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="SAMPLE.xlsx"',
      "Content-Length": fileBuffer.length.toString(),
    },
  });
}
