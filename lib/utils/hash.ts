import crypto from "crypto";

/**
 * Generate a consistent hash for a documentation source
 * Same source = same hash = shared container in Supermemory
 *
 * @param source - Documentation source information
 * @returns 16-character hash for use in container tags
 *
 * @example
 * // URL source
 * generateSourceHash({ type: 'url', identifier: 'https://react.dev' })
 * // => "doc_a1b2c3d4e5f6g7h8"
 *
 * // Google Drive source
 * generateSourceHash({ type: 'google-drive', identifier: 'folder_id_123' })
 * // => "doc_x9y8z7w6v5u4t3s2"
 */
export function generateSourceHash(source: {
  type: "url" | "google-drive";
  identifier: string; // URL or folder ID
  version?: string; // Optional versioning (e.g., 'v18.2.0')
}): string {
  // Normalize URL if needed (remove trailing slash, etc.)
  const normalizedIdentifier =
    source.type === "url"
      ? source.identifier.replace(/\/+$/, "").toLowerCase()
      : source.identifier;

  const content = `${source.type}:${normalizedIdentifier}:${source.version || "latest"}`;

  return crypto
    .createHash("sha256")
    .update(content)
    .digest("hex")
    .substring(0, 16); // First 16 chars for readability
}

/**
 * Container tag types for organizing data in Supermemory
 */
export const ContainerTags = {
  /**
   * Shared documentation container (all users share)
   * @param sourceHash - Hash from generateSourceHash()
   */
  documentation: (sourceHash: string) =>
    [`doc_${sourceHash}`, "documentation"] as const,

  /**
   * User profile container
   * @param userId - User's unique identifier
   */
  userProfile: (userId: string) => [`user_${userId}`, "profile"] as const,

  /**
   * User course progress container
   * @param userId - User's unique identifier
   * @param courseId - Course unique identifier
   */
  courseProgress: (userId: string, courseId: string) =>
    [`user_${userId}_course_${courseId}`, "traversal"] as const,
} as const;
