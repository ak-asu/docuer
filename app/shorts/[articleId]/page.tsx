"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardBody, Button } from "@heroui/react";
import { BookOpen, MessageCircle, Bookmark, Brain, Check } from "lucide-react";
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

export default function ShortsPage() {
  const params = useParams();
  const articleId = params?.articleId as string | undefined;
  const router = useRouter();
  const {
    articles,
    currentArticleIndex,
    setCurrentArticleIndex,
    toggleArticleComplete,
    toggleArticleBookmark,
  } = useStore();

  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [showRelatedArticles, setShowRelatedArticles] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentArticle = articles[currentArticleIndex];

  useEffect(() => {
    if (articleId) {
      const index = articles.findIndex((a) => a.id === articleId);
      if (index !== -1) {
        setCurrentArticleIndex(index);
      }
    }
  }, [articleId, articles, setCurrentArticleIndex]);

  useEffect(() => {
    if (currentArticle) {
      router.replace(`/shorts/${currentArticle.id}`);
    }
  }, [currentArticleIndex, currentArticle, router]);

  const handleDoubleTap = () => {
    const now = Date.now();
    const timeDiff = now - lastTapTime;

    if (timeDiff < 300) {
      toggleArticleComplete(currentArticle.id);
      setShowCompleteAnimation(true);
      setTimeout(() => setShowCompleteAnimation(false), 1000);
    }

    setLastTapTime(now);
  };

  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");

  const handleScroll = (direction: "up" | "down") => {
    if (direction === "up" && currentArticleIndex < articles.length - 1) {
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

  const relatedArticles = articles.filter((a) =>
    currentArticle.relatedArticles.includes(a.id),
  );

  if (!currentArticle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <Layout>
      <div
        className="relative bg-white dark:bg-black flex justify-center overflow-hidden"
        style={{ height: "calc(100vh - 4rem)" }}
      >
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

              <article className="relative h-full flex flex-col justify-center p-6 md:p-12 overflow-y-auto">
                <div className="space-y-6">
                  <header className="space-y-2">
                    <span
                      className="text-sm text-gray-600 dark:text-white/80 font-medium"
                      aria-label="Reading time"
                    >
                      {currentArticle.duration}
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight">
                      {currentArticle.title}
                    </h1>
                  </header>

                  <section
                    className="prose prose-invert prose-lg max-w-none"
                    aria-label="Article content"
                  >
                    <div className="text-gray-800 dark:text-white/90 text-lg leading-relaxed markdown-content">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="mb-4">{children}</p>
                          ),
                          h1: ({ children }) => (
                            <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
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
                            <pre className="bg-white/10 dark:bg-gray-700 p-4 rounded-lg overflow-x-auto mb-4 text-gray-800 dark:text-gray-100">
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
                      Article {currentArticleIndex + 1} of {articles.length}
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

        {/* Action Buttons - Positioned just to the right of the short */}
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
                const index = articles.findIndex(
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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-3">
                    {relatedArticles.length > 0 ? (
                      relatedArticles.map((article) => (
                        <motion.div key={article.id} whileTap={{ scale: 0.98 }}>
                          <Card
                            isPressable
                            onPress={() => {
                              const index = articles.findIndex(
                                (a) => a.id === article.id,
                              );
                              if (index !== -1) {
                                setCurrentArticleIndex(index);
                                setShowRelatedArticles(false);
                              }
                            }}
                            className="shadow-md hover:shadow-lg transition-shadow"
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
