// API route for importing Google Drive files
import { NextRequest, NextResponse } from "next/server";
import { supermemoryService } from "@/lib/services/supermemory";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceHash } = body;

    if (!sourceHash) {
      return NextResponse.json(
        { error: "Source hash is required" },
        { status: 400 },
      );
    }

    // Import files from Google Drive
    const result = await supermemoryService.importFromGoogleDrive(sourceHash);

    return NextResponse.json({
      success: true,
      documentIds: result.documentIds,
      status: result.status,
      count: result.documentIds.length,
    });
  } catch (error) {
    console.error("Google Drive import error:", error);
    return NextResponse.json(
      {
        error: "Failed to import from Google Drive",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
