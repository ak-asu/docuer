// API route for connecting Google Drive
import { NextRequest, NextResponse } from "next/server";
import { supermemoryService } from "@/lib/services/supermemory";

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

    // Get redirect URL for OAuth callback
    const redirectUrl = `${request.nextUrl.origin}/api/integrations/google-drive/callback`;

    // Connect to Google Drive (using userId as container tag)
    const connection = await supermemoryService.connectGoogleDrive(
      userId,
      redirectUrl,
    );

    return NextResponse.json({
      success: true,
      authLink: connection.authLink,
      connectionId: connection.connectionId,
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
