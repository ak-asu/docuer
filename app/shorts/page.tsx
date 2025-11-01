'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardBody, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { BookOpen, MessageCircle, Bookmark, Brain, Check } from 'lucide-react';
import { useStore } from '@/lib/store/useStore';
import QuizModal from '@/app/components/QuizModal';

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
          ? 'bg-blue-600 text-white'
          : 'bg-white/90 text-gray-700 group-hover:bg-white'
      } shadow-lg`}
    >
      <Icon size={24} />
    </div>
    <span className="text-xs text-white drop-shadow-lg font-medium">{label}</span>
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

  const handleScroll = (direction: 'up' | 'down') => {
    if (direction === 'up' && currentArticleIndex < articles.length - 1) {
      setCurrentArticleIndex(currentArticleIndex + 1);
    } else if (direction === 'down' && currentArticleIndex > 0) {
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
        handleScroll('up');
      } else {
        handleScroll('down');
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY > 0) {
      handleScroll('up');
    } else {
      handleScroll('down');
    }
  };

  const relatedArticles = articles.filter((a) =>
    currentArticle.relatedArticles.includes(a.id)
  );

  if (!currentArticle) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <main
      ref={containerRef}
      className="h-screen w-full bg-black overflow-hidden relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      role="main"
      aria-label="Article viewer"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentArticle.id}
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          transition={{ duration: 0.4 }}
          className="h-full w-full relative"
          onClick={handleDoubleTap}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-700 to-green-600 opacity-90" />

          <article className="relative h-full flex flex-col justify-center p-6 md:p-12 max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              <header className="space-y-2">
                <span className="text-white/80 text-sm font-medium" aria-label="Reading time">
                  {currentArticle.duration}
                </span>
                <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                  {currentArticle.title}
                </h1>
              </header>

              <section className="prose prose-invert prose-lg max-w-none" aria-label="Article content">
                <p className="text-white/90 text-lg leading-relaxed whitespace-pre-line">
                  {currentArticle.content}
                </p>
              </section>

              <footer className="flex items-center gap-2 pt-4">
                <div className="text-white/70 text-sm" aria-label="Article progress">
                  Article {currentArticleIndex + 1} of {articles.length}
                </div>
                {currentArticle.completed && (
                  <div className="flex items-center gap-1 text-green-400 text-sm font-medium" role="status" aria-label="Article completed">
                    <Check size={16} aria-hidden="true" />
                    Completed
                  </div>
                )}
              </footer>
            </motion.div>
          </article>

          <div className="absolute right-4 md:right-8 bottom-20 flex flex-col gap-4">
            <ActionButton
              icon={BookOpen}
              label="In-Depth"
              onClick={() => {
                if (relatedArticles.length > 0) {
                  const inDepthArticle = relatedArticles[0];
                  const index = articles.findIndex((a) => a.id === inDepthArticle.id);
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

      <Modal
        aria-labelledby="related-articles-title"
        isOpen={showRelatedArticles}
        onClose={() => setShowRelatedArticles(false)}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <h2 id="related-articles-title" className="text-2xl font-bold">Related Articles</h2>
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
                        const index = articles.findIndex((a) => a.id === article.id);
                        if (index !== -1) {
                          setCurrentArticleIndex(index);
                          setShowRelatedArticles(false);
                        }
                      }}
                      className="shadow-md"
                    >
                      <CardBody>
                        <h3 className="font-semibold text-lg mb-1">{article.title}</h3>
                        <p className="text-sm text-gray-600">{article.duration}</p>
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
            <Button variant="flat" onPress={() => setShowRelatedArticles(false)}>
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
    </main>
  );
}
