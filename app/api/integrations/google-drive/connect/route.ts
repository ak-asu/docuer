// API route for connecting Google Drive
import { NextRequest, NextResponse } from "next/server";
import { supermemoryService } from "@/lib/services/supermemory";
import { generateSourceHash } from "@/lib/utils/hash";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, folderUrl } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    if (!folderUrl) {
      return NextResponse.json(
        { error: "Folder URL is required" },
        { status: 400 },
      );
    }

    // Generate source hash from Google Drive folder
    const sourceHash = generateSourceHash({
      type: "google-drive",
      identifier: folderUrl,
    });

    // Get redirect URL for OAuth callback
    const redirectUrl = `${request.nextUrl.origin}/api/integrations/google-drive/callback`;

    // Connect to Google Drive
    const connection = await supermemoryService.connectGoogleDrive(
      sourceHash,
      redirectUrl,
      userId,
    );

    return NextResponse.json({
      success: true,
      authLink: connection.authLink,
      connectionId: connection.connectionId,
      sourceHash,
      expiresIn: connection.expiresIn,
    });
  } catch (error) {
    console.error("Google Drive connection error:", error);
    return NextResponse.json(
      {
        error: "Failed to connect Google Drive",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
