'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Card, CardBody } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Trophy, RotateCw } from 'lucide-react';
import { useStore } from '@/lib/store/useStore';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleId?: string;
}

export default function QuizModal({ isOpen, onClose }: QuizModalProps) {
  const { quizQuestions, articles, currentArticleIndex } = useStore();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<number[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // Get questions for articles up to current index
  const viewedArticles = articles.slice(0, currentArticleIndex + 1);
  const viewedArticleIds = viewedArticles.map(a => a.id);
  const relevantQuestions = quizQuestions.filter(q =>
    viewedArticleIds.includes(q.articleId)
  );

  useEffect(() => {
    if (!isOpen) {
      resetQuiz();
    }
  }, [isOpen]);

  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setAnsweredQuestions([]);
    setQuizCompleted(false);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (showResult) return;
    setSelectedAnswer(answerIndex);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;

    const currentQuestion = relevantQuestions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    if (isCorrect) {
      setScore(score + 1);
    }

    setShowResult(true);
    setAnsweredQuestions([...answeredQuestions, selectedAnswer]);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < relevantQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setQuizCompleted(true);
    }
  };

  const handleRetakeQuiz = () => {
    resetQuiz();
  };

  if (relevantQuestions.length === 0) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            <h2 className="text-2xl font-bold">Quick Quiz</h2>
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-8">
              <p className="text-gray-600">No quiz questions available yet. Keep reading articles to unlock quizzes!</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  const currentQuestion = relevantQuestions[currentQuestionIndex];
  const isCorrect = showResult && selectedAnswer === currentQuestion.correctAnswer;
  const percentage = Math.round((score / relevantQuestions.length) * 100);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      isDismissable={!showResult}
      hideCloseButton={showResult && !quizCompleted}
    >
      <ModalContent>
        <ModalHeader>
          <div className="flex justify-between items-center w-full">
            <h2 className="text-2xl font-bold">Quick Quiz</h2>
            <span className="text-sm text-gray-600">
              Question {currentQuestionIndex + 1} of {relevantQuestions.length}
            </span>
          </div>
        </ModalHeader>
        <ModalBody>
          {!quizCompleted ? (
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="bg-blue-50 border-2 border-blue-200">
                <CardBody>
                  <h3 className="font-semibold text-lg mb-4">{currentQuestion.question}</h3>
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, index) => {
                      const isSelected = selectedAnswer === index;
                      const isCorrectAnswer = index === currentQuestion.correctAnswer;
                      const showCorrect = showResult && isCorrectAnswer;
                      const showIncorrect = showResult && isSelected && !isCorrect;

                      return (
                        <motion.button
                          key={index}
                          onClick={() => handleAnswerSelect(index)}
                          disabled={showResult}
                          whileHover={!showResult ? { scale: 1.02 } : {}}
                          whileTap={!showResult ? { scale: 0.98 } : {}}
                          className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-center justify-between ${
                            showCorrect
                              ? 'bg-green-100 border-green-500'
                              : showIncorrect
                              ? 'bg-red-100 border-red-500'
                              : isSelected
                              ? 'bg-blue-100 border-blue-500'
                              : 'bg-white border-gray-200 hover:border-blue-300'
                          } ${showResult ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span className="font-medium">{option}</span>
                          {showCorrect && <Check className="text-green-600" size={24} />}
                          {showIncorrect && <X className="text-red-600" size={24} />}
                        </motion.button>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>

              <AnimatePresence>
                {showResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-4 rounded-lg ${
                      isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isCorrect ? (
                        <>
                          <Check className="text-green-600" size={24} />
                          <p className="font-semibold text-green-800">Correct! Well done!</p>
                        </>
                      ) : (
                        <>
                          <X className="text-red-600" size={24} />
                          <p className="font-semibold text-red-800">
                            Incorrect. The correct answer is: {currentQuestion.options[currentQuestion.correctAnswer]}
                          </p>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="bg-blue-600 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${((currentQuestionIndex + (showResult ? 1 : 0)) / relevantQuestions.length) * 100}%`
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-sm text-gray-600">
                  Score: {score}/{relevantQuestions.length}
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8 space-y-6"
            >
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-xl">
                  <Trophy className="text-white" size={48} />
                </div>
              </div>

              <div>
                <h3 className="text-3xl font-bold text-gray-900 mb-2">Quiz Complete!</h3>
                <p className="text-gray-600">You've completed all the questions</p>
              </div>

              <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200">
                <CardBody className="text-center py-6">
                  <p className="text-6xl font-bold text-blue-600 mb-2">{percentage}%</p>
                  <p className="text-gray-700 font-medium">
                    You got {score} out of {relevantQuestions.length} questions correct
                  </p>
                </CardBody>
              </Card>

              {percentage < 70 && (
                <p className="text-gray-600">
                  Consider reviewing the articles to improve your understanding!
                </p>
              )}
              {percentage >= 70 && percentage < 90 && (
                <p className="text-gray-600">
                  Good job! Keep learning to master these topics!
                </p>
              )}
              {percentage >= 90 && (
                <p className="text-green-600 font-semibold">
                  Excellent work! You've mastered these topics!
                </p>
              )}
            </motion.div>
          )}
        </ModalBody>
        <ModalFooter>
          {!quizCompleted ? (
            showResult ? (
              <Button
                color="primary"
                onPress={handleNextQuestion}
                size="lg"
              >
                {currentQuestionIndex < relevantQuestions.length - 1 ? 'Next Question' : 'See Results'}
              </Button>
            ) : (
              <>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={handleSubmitAnswer}
                  isDisabled={selectedAnswer === null}
                  size="lg"
                >
                  Submit Answer
                </Button>
              </>
            )
          ) : (
            <div className="flex gap-2 w-full">
              <Button
                variant="flat"
                onPress={onClose}
                size="lg"
                className="flex-1"
              >
                Close
              </Button>
              <Button
                color="primary"
                onPress={handleRetakeQuiz}
                startContent={<RotateCw size={18} />}
                size="lg"
                className="flex-1"
              >
                Retake Quiz
              </Button>
            </div>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
