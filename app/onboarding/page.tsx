"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, RadioGroup, Radio } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Brain, Clock, Check, Target, Award } from "lucide-react";
import { useStore } from "@/lib/store/useStore";
import { authService } from "@/lib/services/auth";

const steps = [
  {
    id: 1,
    title: "Welcome!",
    description: "Let us personalize your learning experience",
    icon: BookOpen,
  },
  {
    id: 2,
    title: "Experience Level",
    description: "What's your technical background?",
    icon: Award,
  },
  {
    id: 3,
    title: "Learning Goals",
    description: "What do you want to achieve?",
    icon: Target,
  },
  {
    id: 4,
    title: "Specific Interests",
    description: "What topics interest you most?",
    icon: Brain,
  },
  {
    id: 5,
    title: "Time Commitment",
    description: "How much time can you dedicate?",
    icon: Clock,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [experienceLevel, setExperienceLevel] = useState("");
  const [learningGoals, setLearningGoals] = useState<string[]>([]);
  const [specificInterests, setSpecificInterests] = useState<string[]>([]);
  const [timeCommitment, setTimeCommitment] = useState("");
  const { setOnboardingCompleted, updateUserProfile } = useStore();

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      router.replace("/login");
    }
  }, [router]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setOnboardingCompleted(true);
      updateUserProfile({
        name: "Learner",
        level: experienceLevel as "beginner" | "intermediate" | "advanced",
        learningGoals,
        interests: specificInterests,
      });
      router.push("/courses");
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleGoal = (goal: string) => {
    if (learningGoals.includes(goal)) {
      setLearningGoals(learningGoals.filter((g) => g !== goal));
    } else {
      setLearningGoals([...learningGoals, goal]);
    }
  };

  const toggleInterest = (interest: string) => {
    if (specificInterests.includes(interest)) {
      setSpecificInterests(specificInterests.filter((i) => i !== interest));
    } else {
      setSpecificInterests([...specificInterests, interest]);
    }
  };

  const canProceed = () => {
    if (currentStep === 0) return true;
    if (currentStep === 1) return experienceLevel !== "";
    if (currentStep === 2) return learningGoals.length > 0;
    if (currentStep === 3) return specificInterests.length > 0;
    if (currentStep === 4) return timeCommitment !== "";
    return false;
  };

  const CurrentIcon = steps[currentStep].icon;

  return (
    <main className="min-h-screen bg-linear-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <nav className="mb-8 flex justify-center gap-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                index <= currentStep ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-xl">
              <CardBody className="p-8">
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <CurrentIcon className="w-8 h-8 text-blue-600" />
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {steps[currentStep].title}
                  </h1>
                  <p className="text-gray-600">
                    {steps[currentStep].description}
                  </p>
                </div>

                {currentStep === 0 && (
                  <div className="space-y-4">
                    <p className="text-gray-700 text-center">
                      We&apos;re excited to help you on your learning journey.
                      Let&apos;s get started by understanding your preferences.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                      <div className="p-4 bg-blue-50 rounded-lg text-center">
                        <BookOpen className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                        <h3 className="font-semibold text-sm">
                          Curated Courses
                        </h3>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg text-center">
                        <Brain className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <h3 className="font-semibold text-sm">
                          Interactive Quizzes
                        </h3>
                      </div>
                      <div className="p-4 bg-orange-50 rounded-lg text-center">
                        <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                        <h3 className="font-semibold text-sm">
                          Bite-sized Content
                        </h3>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 1 && (
                  <RadioGroup
                    label="Select your experience level"
                    value={experienceLevel}
                    onValueChange={setExperienceLevel}
                  >
                    <Radio value="beginner">
                      <div>
                        <p className="font-medium">Beginner</p>
                        <p className="text-sm text-gray-600">
                          Just starting out, need fundamentals
                        </p>
                      </div>
                    </Radio>
                    <Radio value="intermediate">
                      <div>
                        <p className="font-medium">Intermediate</p>
                        <p className="text-sm text-gray-600">
                          Have some experience, want to level up
                        </p>
                      </div>
                    </Radio>
                    <Radio value="advanced">
                      <div>
                        <p className="font-medium">Advanced</p>
                        <p className="text-sm text-gray-600">
                          Experienced, looking for deep dives
                        </p>
                      </div>
                    </Radio>
                  </RadioGroup>
                )}

                {currentStep === 2 && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700 mb-4">
                      Select all that apply:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        "Advance my career",
                        "Build specific skills",
                        "Learn for personal projects",
                        "Get certified",
                        "Stay updated with technology",
                        "Explore new domains",
                      ].map((goal) => (
                        <button
                          key={goal}
                          onClick={() => toggleGoal(goal)}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            learningGoals.includes(goal)
                              ? "border-blue-600 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-900">
                            {goal}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700 mb-4">
                      What topics interest you?
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        "Web Development",
                        "Mobile Apps",
                        "Backend Systems",
                        "Databases",
                        "Cloud Computing",
                        "Security",
                        "AI/ML",
                        "DevOps",
                        "UI/UX Design",
                        "Data Science",
                        "Blockchain",
                        "APIs",
                      ].map((interest) => (
                        <button
                          key={interest}
                          onClick={() => toggleInterest(interest)}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            specificInterests.includes(interest)
                              ? "border-blue-600 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <p className="text-xs font-medium text-gray-900">
                            {interest}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <RadioGroup
                    label="How much time can you dedicate per day?"
                    value={timeCommitment}
                    onValueChange={setTimeCommitment}
                  >
                    <Radio value="15min">15 minutes</Radio>
                    <Radio value="30min">30 minutes</Radio>
                    <Radio value="1hour">1 hour</Radio>
                    <Radio value="2hours">2+ hours</Radio>
                  </RadioGroup>
                )}

                <div className="flex justify-between mt-8">
                  <Button
                    variant="flat"
                    onPress={handleBack}
                    isDisabled={currentStep === 0}
                  >
                    Back
                  </Button>
                  <Button
                    color="primary"
                    onPress={handleNext}
                    isDisabled={!canProceed()}
                    endContent={
                      currentStep === steps.length - 1 ? (
                        <Check size={18} />
                      ) : null
                    }
                  >
                    {currentStep === steps.length - 1 ? "Get Started" : "Next"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
