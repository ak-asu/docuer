// API route for chatbot conversations using Supermemory
import { NextRequest, NextResponse } from "next/server";
import { supermemoryService } from "@/lib/services/supermemory";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini for generating responses
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, message, conversationHistory } = await request.json();

    if (!userId || !message) {
      return NextResponse.json(
        { error: "User ID and message are required" },
        { status: 400 },
      );
    }

    // Search for relevant information from user's learning history
    let context = "";
    if (supermemoryService.isConfigured()) {
      try {
        const memories = await supermemoryService.searchMemories(
          userId,
          message,
        );

        // Build context from memories
        if (memories.length > 0) {
          const articleIds = new Set(memories.map((m) => m.articleId));
          const completedArticles = memories.filter(
            (m) => m.action === "completed",
          ).length;
          const viewedArticles = memories.filter(
            (m) => m.action === "viewed",
          ).length;
          const quizScores = memories
            .filter((m) => m.action === "quiz_taken" && m.metadata?.quizScore)
            .map((m) => m.metadata!.quizScore as number);

          context = `User Learning Context:
- Total unique articles interacted with: ${articleIds.size}
- Completed articles: ${completedArticles}
- Viewed articles: ${viewedArticles}
- Quiz attempts: ${quizScores.length}
${quizScores.length > 0 ? `- Average quiz score: ${(quizScores.reduce((a, b) => a + b, 0) / quizScores.length).toFixed(1)}%` : ""}

Recent activities:
${memories
  .slice(0, 10)
  .map(
    (m) =>
      `- ${m.action} article ${m.articleId} at ${new Date(m.timestamp).toLocaleString()}`,
  )
  .join("\n")}`;
        }
      } catch (error) {
        console.error("Error fetching memories:", error);
      }
    }

    // Generate response using Gemini
    if (!genAI) {
      return NextResponse.json({
        success: true,
        reply:
          "I'm currently unable to process your request. Please make sure the GEMINI_API_KEY is configured.",
      });
    }

    // Build conversation context
    const conversationContext = ((conversationHistory as Message[]) || [])
      .slice(-5)
      .map(
        (msg: Message) =>
          `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`,
      )
      .join("\n");

    const prompt = `You are a helpful learning assistant for an educational platform called LearnFlow. Your role is to help students with their courses, learning progress, and study-related questions.

${context ? `Here is the user's learning data:\n${context}\n` : ""}

${conversationContext ? `Recent conversation:\n${conversationContext}\n` : ""}

User's question: ${message}

Provide a helpful, friendly, and concise response. If you have access to the user's learning data, use it to personalize your response. If the question is about their progress, reference specific numbers. If they ask for study tips or course recommendations, be encouraging and specific.

Keep your response under 150 words and conversational.`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt,
    });
    const reply = result.text || "";

    return NextResponse.json({
      success: true,
      reply: reply.trim(),
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process chat message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
