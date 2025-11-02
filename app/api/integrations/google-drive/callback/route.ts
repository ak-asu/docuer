// API route for Google Drive OAuth callback
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get callback parameters from Supermemory
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const error = searchParams.get("error");

    if (error) {
      // Redirect to courses page with error
      return NextResponse.redirect(
        new URL(
          `/courses?gdrive_error=${encodeURIComponent(error)}`,
          request.url,
        ),
      );
    }

    if (status === "success") {
      // Redirect to courses page with success message
      return NextResponse.redirect(
        new URL("/courses?gdrive_connected=true", request.url),
      );
    }

    // Default redirect
    return NextResponse.redirect(new URL("/courses", request.url));
  } catch (error) {
    console.error("Google Drive callback error:", error);
    return NextResponse.redirect(
      new URL("/courses?gdrive_error=callback_failed", request.url),
    );
  }
}
