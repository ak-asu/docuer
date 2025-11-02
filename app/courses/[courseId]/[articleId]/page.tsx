"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardBody, Button } from "@heroui/react";
import {
  BookOpen,
  MessageCircle,
  Bookmark,
  Brain,
  Check,
  ArrowLeft,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useStore } from "@/lib/store/useStore";
import { authService } from "@/lib/services/auth";
import QuizModal from "@/app/components/QuizModal";
import Layout from "@/app/components/Layout";

const ActionButton = ({
  icon: Icon,
  label,
  onClick,
  isActive = false,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  variant?: "default" | "complete";
}) => {
  const getButtonStyles = () => {
    if (variant === "complete") {
      return isActive
        ? "bg-green-500 text-white"
        : "bg-blue-500 text-white group-hover:bg-blue-600";
    }
    return isActive
      ? "bg-blue-600 text-white"
      : "bg-white/90 dark:bg-white/90 text-gray-700 group-hover:bg-white";
  };

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1 group"
      aria-label={label}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${getButtonStyles()} shadow-lg`}
      >
        <Icon size={24} />
      </div>
      <span className="text-xs text-gray-900 dark:text-white drop-shadow-lg font-medium">
        {label}
      </span>
    </motion.button>
  );
};

export default function CourseShortPage() {
  const params = useParams();
  const articleId = params?.articleId as string | undefined;
  const courseId = params?.courseId as string | undefined;
  const router = useRouter();
  const {
    articles,
    courses,
    toggleArticleComplete,
    toggleArticleBookmark,
    onboardingCompleted,
  } = useStore();

  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false);
  const [showRelatedArticles, setShowRelatedArticles] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapTimeRef = useRef(0);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      router.replace("/login");
      return;
    }
    if (!onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }
  }, [router, onboardingCompleted]);

  // Filter articles by course
  const courseArticles = articles.filter((a) => a.courseId === courseId);

  // Initialize current article index from URL parameter
  const getInitialIndex = () => {
    if (articleId && courseArticles.length > 0) {
      const index = courseArticles.findIndex((a) => a.id === articleId);
      return index !== -1 ? index : 0;
    }
    return 0;
  };

  const [currentArticleIndex, setCurrentArticleIndex] =
    useState(getInitialIndex);

  const currentArticle = courseArticles[currentArticleIndex];
  const course = courses.find((c) => c.id === courseId);

  // Removed: URL updates now happen synchronously in handleScroll to prevent animation interruption

  const handleDoubleTap = () => {
    const getCurrentTime = () => Date.now();
    const now = getCurrentTime();
    const timeDiff = now - lastTapTimeRef.current;

    if (timeDiff < 300 && currentArticle) {
      toggleArticleComplete(currentArticle.id);
      setShowCompleteAnimation(true);
      setTimeout(() => setShowCompleteAnimation(false), 1000);
    }

    lastTapTimeRef.current = now;
  };

  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastWheelTimeRef = useRef(0);

  const handleScroll = (direction: "up" | "down") => {
    if (isTransitioning) return;

    const canScrollUp =
      direction === "up" && currentArticleIndex < courseArticles.length - 1;
    const canScrollDown = direction === "down" && currentArticleIndex > 0;

    if (canScrollUp) {
      setIsTransitioning(true);
      setScrollDirection("up");
      const newIndex = currentArticleIndex + 1;
      setCurrentArticleIndex(newIndex);

      const newArticle = courseArticles[newIndex];
      if (newArticle && courseId) {
        window.history.replaceState(
          null,
          "",
          `/courses/${courseId}/${newArticle.id}`,
        );
      }

      setTimeout(() => setIsTransitioning(false), 300);
    } else if (canScrollDown) {
      setIsTransitioning(true);
      setScrollDirection("down");
      const newIndex = currentArticleIndex - 1;
      setCurrentArticleIndex(newIndex);

      const newArticle = courseArticles[newIndex];
      if (newArticle && courseId) {
        window.history.replaceState(
          null,
          "",
          `/courses/${courseId}/${newArticle.id}`,
        );
      }

      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isTransitioning) {
      setTouchStartY(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isTransitioning) return;

    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleScroll("up");
      } else {
        handleScroll("down");
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const now = Date.now();
    if (now - lastWheelTimeRef.current < 500 || isTransitioning) {
      return;
    }

    lastWheelTimeRef.current = now;

    if (Math.abs(e.deltaY) > 10) {
      if (e.deltaY > 0) {
        handleScroll("up");
      } else {
        handleScroll("down");
      }
    }
  };

  const relatedArticles = currentArticle
    ? courseArticles.filter((a) =>
        currentArticle.relatedArticles.includes(a.id),
      )
    : [];

  if (!currentArticle || !course) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <p className="text-white text-xl mb-4">
              {!course
                ? "Course not found"
                : "No articles available for this course"}
            </p>
            <Button color="primary" onPress={() => router.push("/courses")}>
              Back to Courses
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        className="relative bg-white dark:bg-black flex justify-center overflow-hidden"
        style={{ height: "calc(100vh - 4rem)" }}
      >
        {/* Back Button */}
        <div className="absolute top-4 left-4 z-10">
          <Button
            isIconOnly
            variant="flat"
            className="bg-white/90 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700"
            onPress={() => router.push(`/courses/${courseId}`)}
            aria-label="Back to course"
          >
            <ArrowLeft size={20} />
          </Button>
        </div>

        <motion.main
          ref={containerRef}
          animate={{ x: showRelatedArticles ? "-25%" : 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-[500px] h-full overflow-hidden relative"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          role="main"
          aria-label="Article viewer"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentArticle.id}
              initial={{ y: scrollDirection === "up" ? "100%" : "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: scrollDirection === "up" ? "-100%" : "100%" }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 m-2"
              onClick={handleDoubleTap}
            >
              <div className="absolute inset-0 bg-linear-to-br from-blue-900 via-blue-700 to-green-600 opacity-90 rounded-lg" />

              <article className="relative h-full flex flex-col justify-center p-6 md:p-12">
                <div className="space-y-6">
                  <header className="space-y-2">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white leading-tight">
                      {currentArticle.title}
                    </h1>
                  </header>

                  <section
                    className="prose prose-invert prose-lg max-w-none"
                    aria-label="Article content"
                  >
                    <div className="text-gray-800 dark:text-white/90 text-base leading-relaxed markdown-content">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="mb-2">{children}</p>
                          ),
                          h1: ({ children }) => (
                            <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                              {children}
                            </h3>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc list-inside mb-2 space-y-1">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal list-inside mb-2 space-y-1">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="text-gray-800 dark:text-gray-100">
                              {children}
                            </li>
                          ),
                          code: ({ children }) => (
                            <code className="bg-white/10 dark:bg-gray-700 px-2 py-1 rounded text-sm text-gray-800 dark:text-gray-100">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-white/10 dark:bg-gray-700 p-4 rounded-lg overflow-x-auto mb-2 text-gray-800 dark:text-gray-100">
                              {children}
                            </pre>
                          ),
                          a: ({ children, href }) => (
                            <a
                              href={href}
                              className="text-blue-600 dark:text-blue-300 hover:text-blue-800 underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {children}
                            </a>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-bold text-gray-900 dark:text-white">
                              {children}
                            </strong>
                          ),
                          em: ({ children }) => (
                            <em className="italic">{children}</em>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-white/30 pl-4 italic my-2">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {currentArticle.content}
                      </ReactMarkdown>
                    </div>
                  </section>
                </div>
              </article>

              <AnimatePresence>
                {showCompleteAnimation && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-2xl">
                      <Check size={64} className="text-white" strokeWidth={3} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </motion.main>

        {/* Action Buttons - Positioned just to the right of the article */}
        <motion.div
          animate={{ x: showRelatedArticles ? "-25%" : 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="absolute left-[calc(50%+250px+1rem)] top-1/2 -translate-y-1/2 flex flex-col gap-4 z-10 max-[1040px]:right-4 max-[1040px]:left-auto"
        >
          <ActionButton
            icon={BookOpen}
            label="In-Depth"
            onClick={() => {
              if (relatedArticles.length > 0) {
                const inDepthArticle = relatedArticles[0];
                const index = courseArticles.findIndex(
                  (a) => a.id === inDepthArticle.id,
                );
                if (index !== -1) setCurrentArticleIndex(index);
              }
            }}
          />
          <ActionButton
            icon={MessageCircle}
            label="Related"
            onClick={() => setShowRelatedArticles(true)}
          />
          <ActionButton
            icon={Bookmark}
            label="Save"
            onClick={() => toggleArticleBookmark(currentArticle.id)}
            isActive={currentArticle.bookmarked}
          />
          <ActionButton
            icon={Brain}
            label="Quiz"
            onClick={() => setShowQuizModal(true)}
          />
          <ActionButton
            icon={Check}
            label="Complete"
            onClick={() => toggleArticleComplete(currentArticle.id)}
            isActive={currentArticle.completed}
            variant="complete"
          />
        </motion.div>
        {/* Related Articles Side Panel */}
        <AnimatePresence>
          {showRelatedArticles && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/50 z-20"
                onClick={() => setShowRelatedArticles(false)}
              />

              {/* Side Panel */}
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-900 z-30 flex flex-col shadow-2xl"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Related Articles
                  </h2>
                  <Button
                    isIconOnly
                    variant="light"
                    onPress={() => setShowRelatedArticles(false)}
                    aria-label="Close panel"
                  >
                    <X size={24} />
                  </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-3">
                    {relatedArticles.length > 0 ? (
                      relatedArticles.map((article) => (
                        <motion.div
                          key={article.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Card
                            isPressable
                            onPress={() => {
                              const index = courseArticles.findIndex(
                                (a) => a.id === article.id,
                              );
                              if (index !== -1) {
                                setCurrentArticleIndex(index);
                                setShowRelatedArticles(false);
                              }
                            }}
                            className="shadow-md"
                          >
                            <CardBody>
                              <h3 className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">
                                {article.title}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {article.duration}
                              </p>
                            </CardBody>
                          </Card>
                        </motion.div>
                      ))
                    ) : (
                      <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                        No related articles available
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <QuizModal
        isOpen={showQuizModal}
        onClose={() => setShowQuizModal(false)}
        articleId={currentArticle.id}
      />
    </Layout>
  );
}
