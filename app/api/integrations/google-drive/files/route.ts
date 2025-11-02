import { NextRequest, NextResponse } from "next/server";
import { supermemoryService } from "@/lib/services/supermemory";

/**
 * GET /api/integrations/google-drive/files
 * Fetches files from Google Drive for the authenticated user
 * Query params:
 *  - userId: user identifier for container tags
 *  - folderId (optional): specific folder to list files from
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const folderId = searchParams.get("folderId");

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

    // List Google Drive documents using SDK
    const documents = await supermemoryService.listGoogleDriveDocuments(
      userId,
      folderId,
    );

    // Transform to expected format
    const files = documents.map((doc) => ({
      id: doc.id,
      name: doc.title || "Untitled",
      mimeType: doc.type,
      isFolder: doc.type === "application/vnd.google-apps.folder",
      children:
        doc.type === "application/vnd.google-apps.folder" ? [] : undefined,
    }));

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error fetching Google Drive files:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch Google Drive files",
      },
      { status: 500 },
    );
  }
}
