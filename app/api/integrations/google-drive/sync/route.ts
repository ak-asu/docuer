import { NextRequest, NextResponse } from "next/server";
import { supermemoryService } from "@/lib/services/supermemory";

/**
 * POST /api/integrations/google-drive/sync
 * Trigger manual sync for Google Drive connection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    if (!supermemoryService.isConfigured()) {
      return NextResponse.json(
        { error: "Supermemory not configured" },
        { status: 500 },
      );
    }

    const result = await supermemoryService.syncGoogleDrive(userId);

    return NextResponse.json({
      success: true,
      status: result.status,
      message: "Sync initiated successfully",
    });
  } catch (error) {
    console.error("Error syncing Google Drive:", error);
    return NextResponse.json(
      {
        error: "Failed to sync Google Drive",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
