import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/services/neo4j";
import { supermemoryService } from "@/lib/services/supermemory";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseId, userId } = body;

    if (!courseId) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400 },
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    console.log(`🗑️ Deleting course ${courseId} for user ${userId}`);

    // Delete from Neo4j (course nodes, topics, articles, user progress)
    if (neo4jService.isConfigured()) {
      console.log("Deleting course data from Neo4j...");
      await neo4jService.deleteCourse(courseId, userId);
      console.log("✅ Neo4j course data deleted");
    } else {
      console.warn("Neo4j not configured - skipping graph deletion");
    }

    // Delete user-specific memories from Supermemory
    // IMPORTANT: This ONLY deletes user behavior data, NOT the shared documentation!
    // Documentation is stored in a separate sourceHash-based container that can be
    // reused by other users who create courses from the same source.
    if (supermemoryService.isConfigured()) {
      console.log("Deleting user-specific course memories from Supermemory...");

      // Delete user behavior memories (views, completions, bookmarks, quizzes)
      await supermemoryService.deleteCourseMemories(userId, courseId);

      // Delete course progress container
      await supermemoryService.deleteCourseProgress(userId, courseId);

      console.log(
        "✅ User-specific Supermemory data deleted (documentation preserved)",
      );
    } else {
      console.warn("Supermemory not configured - skipping memory deletion");
    }

    console.log(`✅ Successfully deleted course ${courseId}`);

    return NextResponse.json({
      success: true,
      message: "Course deleted successfully",
      courseId,
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    return NextResponse.json(
      {
        error: "Failed to delete course",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
