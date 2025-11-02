"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardBody,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import {
  BookOpen,
  MessageCircle,
  Bookmark,
  Brain,
  Check,
  ArrowLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useStore } from "@/lib/store/useStore";
import QuizModal from "@/app/components/QuizModal";
import Layout from "@/app/components/Layout";

const ActionButton = ({
  icon: Icon,
  label,
  onClick,
  isActive = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}) => (
  <motion.button
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className="flex flex-col items-center gap-1 group"
    aria-label={label}
  >
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
        isActive
          ? "bg-blue-600 text-white"
          : "bg-white/90 text-gray-700 group-hover:bg-white"
      } shadow-lg`}
    >
      <Icon size={24} />
    </div>
    <span className="text-xs text-white drop-shadow-lg font-medium">
      {label}
    </span>
  </motion.button>
);

export default function CourseShortPage() {
  const params = useParams();
  const articleId = params?.articleId as string | undefined;
  const courseId = params?.courseId as string | undefined;
  const router = useRouter();
  const { articles, courses, toggleArticleComplete, toggleArticleBookmark } =
    useStore();

  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false);
  const [showRelatedArticles, setShowRelatedArticles] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapTimeRef = useRef(0);

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

  // Keep URL in sync with current article when navigating
  useEffect(() => {
    if (currentArticle && courseId && currentArticle.id !== articleId) {
      router.replace(`/courses/${courseId}/${currentArticle.id}`);
    }
  }, [currentArticleIndex, currentArticle, courseId, articleId, router]);

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

  const handleScroll = (direction: "up" | "down") => {
    if (direction === "up" && currentArticleIndex < courseArticles.length - 1) {
      setScrollDirection("up");
      setCurrentArticleIndex(currentArticleIndex + 1);
    } else if (direction === "down" && currentArticleIndex > 0) {
      setScrollDirection("down");
      setCurrentArticleIndex(currentArticleIndex - 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
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
    if (e.deltaY > 0) {
      handleScroll("up");
    } else {
      handleScroll("down");
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
        className="relative bg-black flex justify-center"
        style={{ height: "calc(100vh - 4rem)" }}
      >
        {/* Back Button */}
        <div className="absolute top-4 left-4 z-10">
          <Button
            isIconOnly
            variant="flat"
            className="bg-white/90 hover:bg-white"
            onPress={() => router.push(`/courses/${courseId}`)}
            aria-label="Back to course"
          >
            <ArrowLeft size={20} />
          </Button>
        </div>

        <main
          ref={containerRef}
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
              initial={{ y: scrollDirection === "down" ? "100%" : "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: scrollDirection === "down" ? "-100%" : "100%" }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0"
              onClick={handleDoubleTap}
            >
              <div className="absolute inset-0 bg-linear-to-br from-blue-900 via-blue-700 to-green-600 opacity-90" />

              <article className="relative h-full flex flex-col justify-center p-6 md:p-12">
                <div className="space-y-6">
                  <header className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-white/80 text-sm font-medium"
                        aria-label="Reading time"
                      >
                        {currentArticle.duration}
                      </span>
                      <span className="text-white/60 text-xs font-medium bg-white/10 px-2 py-1 rounded">
                        {course.title}
                      </span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                      {currentArticle.title}
                    </h1>
                  </header>

                  <section
                    className="prose prose-invert prose-lg max-w-none"
                    aria-label="Article content"
                  >
                    <div className="text-white/90 text-lg leading-relaxed markdown-content">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="mb-4">{children}</p>
                          ),
                          h1: ({ children }) => (
                            <h1 className="text-3xl font-bold mb-4 text-white">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-2xl font-bold mb-3 text-white">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-xl font-semibold mb-2 text-white">
                              {children}
                            </h3>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc list-inside mb-4 space-y-2">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal list-inside mb-4 space-y-2">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="text-white/90">{children}</li>
                          ),
                          code: ({ children }) => (
                            <code className="bg-white/10 px-2 py-1 rounded text-sm">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-white/10 p-4 rounded-lg overflow-x-auto mb-4">
                              {children}
                            </pre>
                          ),
                          a: ({ children, href }) => (
                            <a
                              href={href}
                              className="text-blue-300 hover:text-blue-200 underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {children}
                            </a>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-bold text-white">
                              {children}
                            </strong>
                          ),
                          em: ({ children }) => (
                            <em className="italic">{children}</em>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-white/30 pl-4 italic my-4">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {currentArticle.content}
                      </ReactMarkdown>
                    </div>
                  </section>

                  <footer className="flex items-center gap-2 pt-4">
                    <div
                      className="text-white/70 text-sm"
                      aria-label="Article progress"
                    >
                      Article {currentArticleIndex + 1} of{" "}
                      {courseArticles.length}
                    </div>
                    {currentArticle.completed && (
                      <div
                        className="flex items-center gap-1 text-green-400 text-sm font-medium"
                        role="status"
                        aria-label="Article completed"
                      >
                        <Check size={16} aria-hidden="true" />
                        Completed
                      </div>
                    )}
                  </footer>
                </div>
              </article>

              <div className="absolute right-4 md:right-8 bottom-20 flex flex-col gap-4">
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
              </div>

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
        </main>
      </div>

      <Modal
        aria-labelledby="related-articles-title"
        isOpen={showRelatedArticles}
        onClose={() => setShowRelatedArticles(false)}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <h2 id="related-articles-title" className="text-2xl font-bold">
              Related Articles
            </h2>
          </ModalHeader>
          <ModalBody>
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
                        <h3 className="font-semibold text-lg mb-1">
                          {article.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {article.duration}
                        </p>
                      </CardBody>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <p className="text-gray-600 text-center py-8">
                  No related articles available
                </p>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => setShowRelatedArticles(false)}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <QuizModal
        isOpen={showQuizModal}
        onClose={() => setShowQuizModal(false)}
        articleId={currentArticle.id}
      />
    </Layout>
  );
}
