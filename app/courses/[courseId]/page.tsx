"use client";

import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Progress,
  Chip,
} from "@heroui/react";
import {
  ArrowLeft,
  Play,
  BookOpen,
  CheckCircle,
  Clock,
  Calendar,
} from "lucide-react";
import { useStore } from "@/lib/store/useStore";
import Layout from "@/app/components/Layout";
import KnowledgeGraphVisualization from "@/app/components/KnowledgeGraphVisualization";

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;
  const { courses, articles } = useStore();

  const course = courses.find((c) => c.id === courseId);
  const courseArticles = articles.filter((a) => a.courseId === courseId);
  const completedArticles = courseArticles.filter((a) => a.completed);
  const nextArticle =
    courseArticles.find((a) => !a.completed) || courseArticles[0];

  if (!course) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Course not found
            </h2>
            <Button color="primary" onPress={() => router.push("/courses")}>
              Back to Courses
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const handleContinueLearning = () => {
    if (nextArticle) {
      router.push(`/courses/${courseId}/${nextArticle.id}`);
    }
  };

  return (
    <Layout>
      <main className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Button
              variant="light"
              startContent={<ArrowLeft size={18} />}
              onPress={() => router.push("/courses")}
              className="mb-4"
            >
              Back to Courses
            </Button>

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  {course.title}
                </h1>
                <p className="text-gray-600 text-lg">{course.description}</p>
                <Chip color="primary" variant="flat" className="mt-2">
                  {course.category}
                </Chip>
              </div>

              <Button
                color="primary"
                size="lg"
                startContent={<Play size={20} />}
                onPress={handleContinueLearning}
                isDisabled={courseArticles.length === 0}
              >
                {courseArticles.length === 0
                  ? "No Articles"
                  : "Continue Learning"}
              </Button>
            </div>
          </motion.div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="shadow-md">
                <CardBody className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <BookOpen className="text-blue-600" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Articles</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {courseArticles.length}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="shadow-md">
                <CardBody className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircle className="text-green-600" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Completed</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {completedArticles.length}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="shadow-md">
                <CardBody className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Clock className="text-purple-600" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Progress</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {course.progress}%
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          </div>

          {/* Progress Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <Card className="shadow-md">
              <CardHeader>
                <h2 className="text-xl font-bold text-gray-900">
                  Course Progress
                </h2>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <Progress
                    value={course.progress}
                    color="primary"
                    size="lg"
                    showValueLabel
                  />
                  <p className="text-sm text-gray-600">
                    {completedArticles.length} of {courseArticles.length}{" "}
                    articles completed
                  </p>
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* Knowledge Graph Visualization */}
          {courseArticles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-8"
            >
              <KnowledgeGraphVisualization
                articles={courseArticles}
                courseId={courseId}
                onNodeClick={(articleId) =>
                  router.push(`/courses/${courseId}/${articleId}`)
                }
              />
            </motion.div>
          )}

          {/* Articles List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="shadow-md">
              <CardHeader>
                <h2 className="text-xl font-bold text-gray-900">
                  Course Content
                </h2>
              </CardHeader>
              <CardBody>
                {courseArticles.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">No articles available yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {courseArticles.map((article, index) => (
                      <motion.div
                        key={article.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          article.completed
                            ? "bg-green-50 border-green-200"
                            : "bg-white border-gray-200 hover:border-blue-300"
                        }`}
                        onClick={() =>
                          router.push(`/courses/${courseId}/${article.id}`)
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                article.completed
                                  ? "bg-green-500"
                                  : "bg-gray-200"
                              }`}
                            >
                              {article.completed ? (
                                <CheckCircle className="text-white" size={18} />
                              ) : (
                                <span className="text-sm font-semibold text-gray-700">
                                  {index + 1}
                                </span>
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">
                                {article.title}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Clock size={14} className="text-gray-500" />
                                <span className="text-sm text-gray-600">
                                  {article.duration}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              color={article.completed ? "success" : "primary"}
                              variant={article.completed ? "flat" : "solid"}
                              onPress={() =>
                                router.push(
                                  `/courses/${courseId}/${article.id}`,
                                )
                              }
                            >
                              {article.completed ? "Review" : "Start"}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>

          {/* Course Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8"
          >
            <Card className="shadow-md">
              <CardHeader>
                <h2 className="text-xl font-bold text-gray-900">
                  Course Information
                </h2>
              </CardHeader>
              <CardBody>
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar size={18} />
                  <span className="text-sm">
                    Created on{" "}
                    {new Date(course.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </main>
    </Layout>
  );
}
