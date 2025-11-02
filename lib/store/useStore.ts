import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { authService } from "../services/auth";

export interface UserPreferences {
  theme: "light" | "dark";
  notifications: boolean;
  courseReminders: boolean;
  language: string;
}

export interface UserProfile {
  name: string;
  email: string;
  joinedDate: string;
  completedArticles: number;
  completedCourses: number;
  currentStreak: number;
  level?: "beginner" | "intermediate" | "advanced";
  learningGoals?: string[];
  interests?: string[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  progress: number;
  totalArticles: number;
  completedArticles: number;
  category: string;
  createdAt: string;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  courseId: string;
  duration: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  completed: boolean;
  bookmarked: boolean;
  relatedArticles: string[];
  prerequisites?: string[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  articleId: string;
}

interface AppState {
  _hasHydrated: boolean;
  onboardingCompleted: boolean;
  userPreferences: UserPreferences;
  userProfile: UserProfile;
  courses: Course[];
  articles: Article[];
  quizQuestions: QuizQuestion[];
  bookmarkedArticles: string[];
  currentArticleIndex: number;
  isLoading: boolean;
  error: string | null;

  setHasHydrated: (state: boolean) => void;

  setOnboardingCompleted: (completed: boolean) => void;
  updateUserPreferences: (preferences: Partial<UserPreferences>) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  addCourse: (course: Course) => void;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  deleteCourse: (id: string) => Promise<void>;
  toggleArticleComplete: (articleId: string) => void;
  toggleArticleBookmark: (articleId: string) => void;
  setCurrentArticleIndex: (index: number) => void;
  incrementArticleIndex: () => void;
  decrementArticleIndex: () => void;

  // API integration methods
  createCourseFromUrl: (
    url: string,
    title: string,
    description: string,
    category: string,
  ) => Promise<void>;
  generateQuizForArticle: (articleId: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addArticles: (articles: Article[]) => void;
  addQuizQuestions: (questions: QuizQuestion[]) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      _hasHydrated: false,
      onboardingCompleted: false,
      userPreferences: {
        theme: "light",
        notifications: true,
        courseReminders: true,
        language: "en",
      },
      userProfile: {
        name: "",
        email: "",
        joinedDate: new Date().toISOString(),
        completedArticles: 0,
        completedCourses: 0,
        currentStreak: 0,
      },
      courses: [],
      articles: [],
      quizQuestions: [],
      bookmarkedArticles: [],
      currentArticleIndex: 0,
      isLoading: false,
      error: null,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      setOnboardingCompleted: (completed) =>
        set({ onboardingCompleted: completed }),

      updateUserPreferences: (preferences) =>
        set((state) => ({
          userPreferences: { ...state.userPreferences, ...preferences },
        })),

      updateUserProfile: (profile) =>
        set((state) => ({
          userProfile: { ...state.userProfile, ...profile },
        })),

      addCourse: (course) =>
        set((state) => ({
          courses: [...state.courses, course],
        })),

      updateCourse: (id, updates) =>
        set((state) => ({
          courses: state.courses.map((course) =>
            course.id === id ? { ...course, ...updates } : course,
          ),
        })),

      deleteCourse: async (id) => {
        // Get userId from auth service
        const currentUser = authService.getCurrentUser();
        if (!currentUser) {
          console.error("User not authenticated");
          return;
        }
        const userId = currentUser.id;

        try {
          // Call API to delete course from Neo4j and Supermemory
          const response = await fetch("/api/courses/delete", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              courseId: id,
              userId,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to delete course");
          }

          // Remove course and its articles from local state
          set((state) => ({
            courses: state.courses.filter((course) => course.id !== id),
            articles: state.articles.filter(
              (article) => article.courseId !== id,
            ),
            quizQuestions: state.quizQuestions.filter(
              (quiz) =>
                !state.articles.some(
                  (a) => a.id === quiz.articleId && a.courseId === id,
                ),
            ),
          }));

          console.log(`✅ Course ${id} deleted successfully`);
        } catch (error) {
          console.error("Failed to delete course:", error);
          // Even if API fails, remove from local state
          set((state) => ({
            courses: state.courses.filter((course) => course.id !== id),
            articles: state.articles.filter(
              (article) => article.courseId !== id,
            ),
          }));
        }
      },

      toggleArticleBookmark: (articleId) =>
        set((state) => {
          const article = state.articles.find((a) => a.id === articleId);
          if (!article) return state;

          const isBookmarked = state.bookmarkedArticles.includes(articleId);

          return {
            articles: state.articles.map((a) =>
              a.id === articleId ? { ...a, bookmarked: !isBookmarked } : a,
            ),
            bookmarkedArticles: isBookmarked
              ? state.bookmarkedArticles.filter((id) => id !== articleId)
              : [...state.bookmarkedArticles, articleId],
          };
        }),

      setCurrentArticleIndex: (index) => set({ currentArticleIndex: index }),

      incrementArticleIndex: () =>
        set((state) => {
          const maxIndex = state.articles.length - 1;
          return {
            currentArticleIndex: Math.min(
              state.currentArticleIndex + 1,
              maxIndex,
            ),
          };
        }),

      decrementArticleIndex: () =>
        set((state) => ({
          currentArticleIndex: Math.max(state.currentArticleIndex - 1, 0),
        })),

      // API integration methods
      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      addArticles: (articles) =>
        set((state) => ({
          articles: [...state.articles, ...articles],
        })),

      addQuizQuestions: (questions) =>
        set((state) => ({
          quizQuestions: [...state.quizQuestions, ...questions],
        })),

      createCourseFromUrl: async (url, title, description, category) => {
        set({ isLoading: true, error: null });
        try {
          // Get userId from auth service
          const currentUser = authService.getCurrentUser();
          if (!currentUser) {
            throw new Error("User not authenticated");
          }
          const userId = currentUser.id;

          const response = await fetch("/api/courses/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url,
              title,
              description,
              category,
              userId,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to create course");
          }

          const data = await response.json();

          if (data.success) {
            // Add course to store
            set((state) => ({
              courses: [...state.courses, data.course],
              articles: [...state.articles, ...data.articles],
              isLoading: false,
            }));
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      generateQuizForArticle: async (articleId) => {
        set({ isLoading: true, error: null });
        try {
          const article = useStore
            .getState()
            .articles.find((a) => a.id === articleId);
          if (!article) {
            throw new Error("Article not found");
          }

          const response = await fetch("/api/quiz/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ article }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to generate quiz");
          }

          const data = await response.json();

          if (data.success && data.questions) {
            set((state) => ({
              quizQuestions: [...state.quizQuestions, ...data.questions],
              isLoading: false,
            }));
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      toggleArticleComplete: (articleId) =>
        set((state) => {
          const article = state.articles.find((a) => a.id === articleId);
          if (!article) return state;

          const wasCompleted = article.completed;
          const newCompleted = !wasCompleted;

          // Call API to track completion
          if (newCompleted) {
            const currentUser = authService.getCurrentUser();
            if (currentUser) {
              fetch("/api/articles/complete", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  userId: currentUser.id,
                  articleId,
                  courseId: article.courseId,
                }),
              }).catch((error) =>
                console.error("Failed to track completion:", error),
              );
            }
          }

          return {
            articles: state.articles.map((a) =>
              a.id === articleId ? { ...a, completed: newCompleted } : a,
            ),
            userProfile: {
              ...state.userProfile,
              completedArticles: wasCompleted
                ? state.userProfile.completedArticles - 1
                : state.userProfile.completedArticles + 1,
            },
          };
        }),
    }),
    {
      name: "learning-app-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        onboardingCompleted: state.onboardingCompleted,
        userPreferences: state.userPreferences,
        userProfile: state.userProfile,
        courses: state.courses,
        articles: state.articles,
        bookmarkedArticles: state.bookmarkedArticles,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

// Hook to check if store has hydrated from localStorage
export const useHasHydrated = () => {
  return useStore((state) => state._hasHydrated);
};

// Hook to check authentication and onboarding with hydration awareness
export const useAuthCheck = () => {
  const hasHydrated = useHasHydrated();
  const onboardingCompleted = useStore((state) => state.onboardingCompleted);

  return {
    hasHydrated,
    onboardingCompleted,
    shouldCheckAuth: hasHydrated, // Only check auth after hydration
  };
};
