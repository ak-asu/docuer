import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserPreferences {
  theme: 'light' | 'dark';
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
  completed: boolean;
  bookmarked: boolean;
  relatedArticles: string[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  articleId: string;
}

interface AppState {
  onboardingCompleted: boolean;
  userPreferences: UserPreferences;
  userProfile: UserProfile;
  courses: Course[];
  articles: Article[];
  quizQuestions: QuizQuestion[];
  bookmarkedArticles: string[];
  currentArticleIndex: number;

  setOnboardingCompleted: (completed: boolean) => void;
  updateUserPreferences: (preferences: Partial<UserPreferences>) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  addCourse: (course: Course) => void;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
  toggleArticleComplete: (articleId: string) => void;
  toggleArticleBookmark: (articleId: string) => void;
  setCurrentArticleIndex: (index: number) => void;
  incrementArticleIndex: () => void;
  decrementArticleIndex: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      userPreferences: {
        theme: 'light',
        notifications: true,
        courseReminders: true,
        language: 'en',
      },
      userProfile: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        joinedDate: new Date().toISOString(),
        completedArticles: 0,
        completedCourses: 0,
        currentStreak: 0,
      },
      courses: [
        {
          id: '1',
          title: 'Introduction to React',
          description: 'Learn the fundamentals of React development',
          progress: 45,
          totalArticles: 20,
          completedArticles: 9,
          category: 'Frontend',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Advanced TypeScript',
          description: 'Master TypeScript patterns and best practices',
          progress: 20,
          totalArticles: 15,
          completedArticles: 3,
          category: 'Programming',
          createdAt: new Date().toISOString(),
        },
      ],
      articles: [
        {
          id: 'a1',
          title: 'Understanding React Hooks',
          content: 'React Hooks are functions that let you use state and other React features without writing a class. They were introduced in React 16.8 and have revolutionized how we write React components.\n\nThe most commonly used hooks are useState and useEffect. useState allows you to add state to functional components, while useEffect lets you perform side effects like data fetching, subscriptions, or manually changing the DOM.\n\nHooks follow two main rules: only call hooks at the top level of your component, and only call hooks from React functions.',
          courseId: '1',
          duration: '5 min read',
          completed: false,
          bookmarked: false,
          relatedArticles: ['a2', 'a3'],
        },
        {
          id: 'a2',
          title: 'Deep Dive into useState',
          content: 'The useState hook is the most fundamental hook in React. It returns a pair: the current state value and a function to update it.\n\nWhen you call useState, you pass the initial state as an argument. The hook returns an array with two elements: the current state value and a setter function.\n\nThe setter function can accept either a new value or a function that receives the previous state and returns the new state. This functional update form is useful when the new state depends on the previous state.',
          courseId: '1',
          duration: '7 min read',
          completed: false,
          bookmarked: false,
          relatedArticles: ['a1', 'a4'],
        },
        {
          id: 'a3',
          title: 'Mastering useEffect',
          content: 'useEffect is a powerful hook that handles side effects in React components. It combines the functionality of componentDidMount, componentDidUpdate, and componentWillUnmount.\n\nThe hook accepts two arguments: a function containing the side effect code, and an optional dependency array. The dependency array controls when the effect runs.\n\nIf you omit the dependency array, the effect runs after every render. An empty array means it runs only once after the initial render. Including specific values means it runs when those values change.',
          courseId: '1',
          duration: '8 min read',
          completed: false,
          bookmarked: false,
          relatedArticles: ['a1', 'a2'],
        },
        {
          id: 'a4',
          title: 'TypeScript Basics',
          content: 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. It adds optional static typing to JavaScript, helping catch errors during development.\n\nThe type system in TypeScript is powerful and flexible. You can define types for variables, function parameters, return values, and object shapes.\n\nTypeScript supports interfaces, generics, union types, intersection types, and many other advanced features that make your code more maintainable and self-documenting.',
          courseId: '2',
          duration: '6 min read',
          completed: false,
          bookmarked: false,
          relatedArticles: ['a5', 'a6'],
        },
        {
          id: 'a5',
          title: 'Advanced Types in TypeScript',
          content: 'TypeScript offers several advanced type features that enable sophisticated type checking. Union types allow a value to be one of several types, while intersection types combine multiple types.\n\nGeneric types provide a way to create reusable components that work with multiple types. They act like variables for types, allowing you to write flexible, type-safe code.\n\nUtility types like Partial, Pick, Omit, and Record help you transform existing types in useful ways without redefining them.',
          courseId: '2',
          duration: '10 min read',
          completed: false,
          bookmarked: false,
          relatedArticles: ['a4', 'a6'],
        },
        {
          id: 'a6',
          title: 'TypeScript with React',
          content: 'Using TypeScript with React provides excellent type safety for your components. You can type props, state, events, and refs to catch errors at compile time.\n\nReact provides built-in types like React.FC, React.ReactNode, and React.HTMLAttributes. These types help you write type-safe components with minimal boilerplate.\n\nTyping hooks is straightforward: useState accepts a generic type parameter, and useRef requires specifying the element or value type.',
          courseId: '2',
          duration: '9 min read',
          completed: false,
          bookmarked: false,
          relatedArticles: ['a4', 'a5'],
        },
      ],
      quizQuestions: [
        {
          id: 'q1',
          question: 'What is the primary benefit of React Hooks?',
          options: [
            'Better performance',
            'Use state and lifecycle features without classes',
            'Easier styling',
            'Faster rendering',
          ],
          correctAnswer: 1,
          articleId: 'a1',
        },
        {
          id: 'q2',
          question: 'What does the useState hook return?',
          options: [
            'A single value',
            'An object with state methods',
            'An array with current state and setter function',
            'A promise',
          ],
          correctAnswer: 2,
          articleId: 'a2',
        },
        {
          id: 'q3',
          question: 'What happens if you omit the dependency array in useEffect?',
          options: [
            'The effect runs once',
            'The effect never runs',
            'The effect runs after every render',
            'The effect throws an error',
          ],
          correctAnswer: 2,
          articleId: 'a3',
        },
        {
          id: 'q4',
          question: 'What is TypeScript?',
          options: [
            'A JavaScript runtime',
            'A typed superset of JavaScript',
            'A JavaScript framework',
            'A code editor',
          ],
          correctAnswer: 1,
          articleId: 'a4',
        },
        {
          id: 'q5',
          question: 'What are generic types in TypeScript used for?',
          options: [
            'Only for arrays',
            'Creating reusable, type-safe components',
            'Styling components',
            'Error handling',
          ],
          correctAnswer: 1,
          articleId: 'a5',
        },
        {
          id: 'q6',
          question: 'Which React type is used for typing component props?',
          options: [
            'React.Component',
            'React.Props',
            'React.FC or custom interface',
            'React.Element',
          ],
          correctAnswer: 2,
          articleId: 'a6',
        },
      ],
      bookmarkedArticles: [],
      currentArticleIndex: 0,

      setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),

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
            course.id === id ? { ...course, ...updates } : course
          ),
        })),

      deleteCourse: (id) =>
        set((state) => ({
          courses: state.courses.filter((course) => course.id !== id),
        })),

      toggleArticleComplete: (articleId) =>
        set((state) => {
          const article = state.articles.find((a) => a.id === articleId);
          if (!article) return state;

          const wasCompleted = article.completed;
          const newCompleted = !wasCompleted;

          return {
            articles: state.articles.map((a) =>
              a.id === articleId ? { ...a, completed: newCompleted } : a
            ),
            userProfile: {
              ...state.userProfile,
              completedArticles: wasCompleted
                ? state.userProfile.completedArticles - 1
                : state.userProfile.completedArticles + 1,
            },
          };
        }),

      toggleArticleBookmark: (articleId) =>
        set((state) => {
          const article = state.articles.find((a) => a.id === articleId);
          if (!article) return state;

          const isBookmarked = state.bookmarkedArticles.includes(articleId);

          return {
            articles: state.articles.map((a) =>
              a.id === articleId ? { ...a, bookmarked: !isBookmarked } : a
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
            currentArticleIndex: Math.min(state.currentArticleIndex + 1, maxIndex),
          };
        }),

      decrementArticleIndex: () =>
        set((state) => ({
          currentArticleIndex: Math.max(state.currentArticleIndex - 1, 0),
        })),
    }),
    {
      name: 'learning-app-storage',
    }
  )
);
