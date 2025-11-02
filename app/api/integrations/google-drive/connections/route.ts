import { NextRequest, NextResponse } from "next/server";
import { supermemoryService } from "@/lib/services/supermemory";

/**
 * GET /api/integrations/google-drive/connections
 * List all Google Drive connections for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

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

    const connections =
      await supermemoryService.listGoogleDriveConnections(userId);

    return NextResponse.json({
      connections: connections.map((conn) => ({
        id: conn.id,
        provider: conn.provider,
        email: conn.email,
        createdAt: conn.createdAt,
        documentLimit: conn.documentLimit,
      })),
    });
  } catch (error) {
    console.error("Error listing Google Drive connections:", error);
    return NextResponse.json(
      {
        error: "Failed to list connections",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/integrations/google-drive/connections
 * Delete a Google Drive connection
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

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

    const result = await supermemoryService.deleteGoogleDriveConnection(userId);

    return NextResponse.json({
      success: true,
      connectionId: result.id,
      provider: result.provider,
    });
  } catch (error) {
    console.error("Error deleting Google Drive connection:", error);
    return NextResponse.json(
      {
        error: "Failed to delete connection",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
