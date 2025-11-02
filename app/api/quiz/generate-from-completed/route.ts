// API route for generating quiz questions from completed articles
import { NextRequest, NextResponse } from "next/server";
import type { Article, QuizQuestion } from "@/lib/store/useStore";
import { geminiService } from "@/lib/services/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { completedArticles } = body as {
      completedArticles: Article[];
    };

    if (!completedArticles || completedArticles.length === 0) {
      return NextResponse.json(
        { error: "No completed articles provided" },
        { status: 400 },
      );
    }

    if (!geminiService.isConfigured()) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 },
      );
    }

    // Randomly select up to 5 articles
    const shuffled = [...completedArticles].sort(() => Math.random() - 0.5);
    const selectedArticles = shuffled.slice(
      0,
      Math.min(5, completedArticles.length),
    );

    // Generate 1 question per selected article
    const allQuestions: QuizQuestion[] = [];

    for (let i = 0; i < selectedArticles.length; i++) {
      const article = selectedArticles[i];

      try {
        const prompt = `Generate 1 multiple-choice quiz question based on this article.

Article: ${article.title}

Content:
${article.content}

Requirements:
1. Create 1 question
2. The question should have 4 options
3. Test understanding and application, not just memorization
4. Ensure the question is relevant to the article content

Return ONLY a JSON array with this exact format:
[
  {
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0
  }
]`;

        const responseText = await geminiService.generateContent(prompt);

        // Extract JSON from the response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error("Failed to extract quiz questions from response");
          continue;
        }

        const rawQuestions = JSON.parse(jsonMatch[0]) as Array<{
          question: string;
          options: string[];
          correctAnswer: number;
        }>;

        // Map questions to the correct format
        const questions = rawQuestions.map((q, index) => ({
          id: `quiz-completed-${article.id}-${Date.now()}-${index}`,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          articleId: article.id,
        }));

        allQuestions.push(...questions);
      } catch (error) {
        console.error(
          `Failed to generate quiz for article ${article.id}:`,
          error,
        );
      }
    }

    // Return all generated questions (1 per selected article)
    return NextResponse.json({
      success: true,
      questions: allQuestions,
    });
  } catch (error) {
    console.error("Quiz generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate quiz",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
