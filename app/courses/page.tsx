"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Tabs,
  Tab,
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Progress,
} from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, BookOpen, Edit, Trash2, Play } from "lucide-react";
import { z } from "zod";
import { useStore, Course } from "@/lib/store/useStore";
import EditCourseModal from "@/app/components/EditCourseModal";
import GoogleDriveFilePicker from "@/app/components/GoogleDriveFilePicker";
import Layout from "@/app/components/Layout";
import { sanitizeInput } from "@/lib/utils/seo";

const courseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.string().min(1, "Please select a category"),
});

type CourseFormData = z.infer<typeof courseSchema>;

export default function CoursesPage() {
  const router = useRouter();
  const {
    courses,
    articles,
    addCourse,
    deleteCourse,
    createCourseFromUrl,
    isLoading,
    error,
  } = useStore();
  const [selectedTab, setSelectedTab] = useState("existing");
  const [formData, setFormData] = useState<CourseFormData>({
    title: "",
    description: "",
    category: "",
  });
  const [documentationUrl, setDocumentationUrl] = useState("");
  const [googleDriveUrl, setGoogleDriveUrl] = useState("");
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<string[]>([]);
  const [showFilePickerDialog, setShowFilePickerDialog] = useState(false);
  const [sourceType, setSourceType] = useState<
    "url" | "gdrive" | "url-advanced"
  >("url");
  const [errors, setErrors] = useState<
    Partial<Record<keyof CourseFormData, string>>
  >({});
  const [notification, setNotification] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const showNotification = (type: "error" | "success", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const categories = [
    "Frontend",
    "Backend",
    "DevOps",
    "Data Science",
    "Mobile",
    "Design",
    "Programming",
  ];

  const handleInputChange = (field: keyof CourseFormData, value: string) => {
    // Sanitize input to prevent XSS
    const sanitizedValue = sanitizeInput(value);
    setFormData({ ...formData, [field]: sanitizedValue });
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  const handleEditCourse = (course: Course) => {
    setSelectedCourse(course);
    setIsEditModalOpen(true);
  };

  const checkGoogleDriveConnection = (): boolean => {
    const { userProfile } = useStore.getState();
    const savedConnection = localStorage.getItem(
      `gdrive_connection_${userProfile.email}`,
    );
    return savedConnection !== null;
  };

  const handleSelectFilesFromDrive = () => {
    if (!checkGoogleDriveConnection()) {
      showNotification(
        "error",
        "Please connect Google Drive first in your profile settings",
      );
      // Redirect to profile page after a short delay
      setTimeout(() => {
        router.push("/profile");
      }, 1500);
      return;
    }
    setShowFilePickerDialog(true);
  };

  const handleCreateCourse = async () => {
    try {
      courseSchema.parse(formData);

      // Validate documentation source
      if (sourceType === "url" && !documentationUrl) {
        showNotification("error", "Please provide a documentation URL");
        return;
      }

      if (sourceType === "url-advanced" && !documentationUrl) {
        showNotification("error", "Please provide a documentation URL");
        return;
      }

      if (sourceType === "gdrive" && selectedDriveFiles.length === 0) {
        showNotification(
          "error",
          "Please select at least one file from Google Drive",
        );
        return;
      }

      if (sourceType === "url" && documentationUrl) {
        // Create course from documentation URL using API
        await createCourseFromUrl(
          documentationUrl,
          formData.title,
          formData.description,
          formData.category,
        );
      } else if (sourceType === "gdrive" && selectedDriveFiles.length > 0) {
        // Create course from Google Drive files
        // This would call the API to import the selected files
        showNotification(
          "success",
          `Google Drive integration - ${selectedDriveFiles.length} file(s) selected for import`,
        );
        // TODO: Call API to create course from Drive files
      } else if (sourceType === "url-advanced" && documentationUrl) {
        // TODO: Implement two-phase Firecrawl
        showNotification(
          "success",
          "Advanced URL selection - Backend ready! URL: " + documentationUrl,
        );
      }

      setFormData({ title: "", description: "", category: "" });
      setDocumentationUrl("");
      setGoogleDriveUrl("");
      setSelectedDriveFiles([]);
      setSourceType("url");
      setErrors({});
      setSelectedTab("existing");
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof CourseFormData, string>> = {};
        err.issues.forEach((error: z.ZodIssue) => {
          const field = error.path[0] as keyof CourseFormData;
          newErrors[field] = error.message;
        });
        setErrors(newErrors);
      }
    }
  };

  const handleDeleteCourse = (id: string) => {
    deleteCourse(id);
  };

  const handleContinueCourse = (courseId: string) => {
    const courseArticles = articles.filter((a) => a.courseId === courseId);
    const nextArticle =
      courseArticles.find((a) => !a.completed) || courseArticles[0];

    if (nextArticle) {
      router.push(`/courses/${courseId}/${nextArticle.id}`);
    }
  };

  const handleCourseCardClick = (courseId: string) => {
    router.push(`/courses/${courseId}`);
  };

  return (
    <Layout>
      <main
        className="min-h-screen bg-gray-50 p-4 md:p-8"
        role="main"
        aria-label="Courses management"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              My Courses
            </h1>
            <p className="text-gray-600">Manage your learning journey</p>
          </motion.div>

          <Card className="shadow-lg">
            <CardBody className="p-0">
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => setSelectedTab(key as string)}
                className="w-full"
                size="lg"
              >
                <Tab
                  key="existing"
                  title={
                    <div className="flex items-center gap-2">
                      <BookOpen size={18} />
                      <span>Existing Courses</span>
                    </div>
                  }
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="existing"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="p-6 space-y-4"
                    >
                      {courses.length === 0 ? (
                        <div className="text-center py-12">
                          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 mb-4">
                            No courses yet. Create your first course!
                          </p>
                          <Button
                            color="primary"
                            onPress={() => setSelectedTab("create")}
                            startContent={<Plus size={18} />}
                          >
                            Create Course
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {courses.map((course, index) => (
                            <motion.div
                              key={course.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.1 }}
                              onClick={() => handleCourseCardClick(course.id)}
                              className="cursor-pointer"
                            >
                              <Card className="shadow-md hover:shadow-lg transition-shadow">
                                <CardHeader className="flex flex-col items-start pb-2">
                                  <div className="flex justify-between items-start w-full mb-2">
                                    <div className="flex-1">
                                      <h3 className="text-lg font-semibold text-gray-900">
                                        {course.title}
                                      </h3>
                                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                        {course.category}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-2">
                                    {course.description}
                                  </p>
                                </CardHeader>
                                <CardBody className="pt-0">
                                  <div className="space-y-3">
                                    <div>
                                      <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">
                                          Progress
                                        </span>
                                        <span className="font-semibold text-gray-900">
                                          {course.progress}%
                                        </span>
                                      </div>
                                      <Progress
                                        value={course.progress}
                                        color="primary"
                                        size="sm"
                                      />
                                    </div>
                                    <p className="text-sm text-gray-600">
                                      {course.completedArticles} of{" "}
                                      {course.totalArticles} articles completed
                                    </p>
                                    <div
                                      className="flex gap-2 pt-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button
                                        color="primary"
                                        size="sm"
                                        startContent={<Play size={16} />}
                                        className="flex-1"
                                        onPress={() =>
                                          handleContinueCourse(course.id)
                                        }
                                      >
                                        Continue
                                      </Button>
                                      <Button
                                        variant="flat"
                                        size="sm"
                                        isIconOnly
                                        onPress={() => handleEditCourse(course)}
                                        startContent={<Edit size={16} />}
                                        aria-label="Edit course"
                                      />
                                      <Button
                                        color="danger"
                                        variant="flat"
                                        size="sm"
                                        isIconOnly
                                        onPress={() =>
                                          handleDeleteCourse(course.id)
                                        }
                                        startContent={<Trash2 size={16} />}
                                        aria-label="Delete course"
                                      />
                                    </div>
                                  </div>
                                </CardBody>
                              </Card>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </Tab>

                <Tab
                  key="create"
                  title={
                    <div className="flex items-center gap-2">
                      <Plus size={18} />
                      <span>Create New</span>
                    </div>
                  }
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="create"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="p-6"
                    >
                      <div className="max-w-2xl mx-auto space-y-6">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Create New Course
                          </h2>
                          <p className="text-gray-600">
                            Build a personalized learning path
                          </p>
                        </div>

                        <Input
                          label="Course Title"
                          placeholder="e.g., Advanced React Patterns"
                          value={formData.title}
                          onChange={(e) =>
                            handleInputChange("title", e.target.value)
                          }
                          isInvalid={!!errors.title}
                          errorMessage={errors.title}
                          size="lg"
                        />

                        <Textarea
                          label="Description"
                          placeholder="Describe what students will learn in this course..."
                          value={formData.description}
                          onChange={(e) =>
                            handleInputChange("description", e.target.value)
                          }
                          isInvalid={!!errors.description}
                          errorMessage={errors.description}
                          minRows={4}
                        />

                        <Select
                          label="Category"
                          placeholder="Select a category"
                          selectedKeys={
                            formData.category ? [formData.category] : []
                          }
                          onChange={(e) =>
                            handleInputChange("category", e.target.value)
                          }
                          isInvalid={!!errors.category}
                          errorMessage={errors.category}
                        >
                          {categories.map((category) => (
                            <SelectItem key={category}>{category}</SelectItem>
                          ))}
                        </Select>

                        <div className="border-t pt-4 space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">
                              Documentation Source *
                            </label>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="sourceType"
                                  value="url"
                                  checked={sourceType === "url"}
                                  onChange={(e) =>
                                    setSourceType(e.target.value as "url")
                                  }
                                  className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm">
                                  Documentation URL
                                </span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="sourceType"
                                  value="gdrive"
                                  checked={sourceType === "gdrive"}
                                  onChange={(e) =>
                                    setSourceType(e.target.value as "gdrive")
                                  }
                                  className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm">Google Drive</span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="sourceType"
                                  value="url-advanced"
                                  checked={sourceType === "url-advanced"}
                                  onChange={(e) =>
                                    setSourceType(
                                      e.target.value as "url-advanced",
                                    )
                                  }
                                  className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm">
                                  Advanced URL Selection
                                </span>
                              </label>
                            </div>
                          </div>

                          <AnimatePresence mode="wait">
                            {sourceType === "url" && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                key="url-input"
                              >
                                <Input
                                  label="Documentation URL"
                                  placeholder="https://react.dev/learn"
                                  value={documentationUrl}
                                  onChange={(e) =>
                                    setDocumentationUrl(e.target.value)
                                  }
                                  description="We'll automatically scrape and generate learning content"
                                  size="lg"
                                />
                              </motion.div>
                            )}

                            {sourceType === "gdrive" && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                key="gdrive-input"
                                className="space-y-3"
                              >
                                <div className="flex items-center gap-3">
                                  <Button
                                    color="primary"
                                    variant="flat"
                                    onPress={handleSelectFilesFromDrive}
                                    size="lg"
                                  >
                                    Select Files from Google Drive
                                  </Button>
                                  {selectedDriveFiles.length > 0 && (
                                    <span className="text-sm text-gray-600">
                                      {selectedDriveFiles.length} file(s)
                                      selected
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600">
                                  Connect your Google Drive in the profile page
                                  first, then select specific documents to
                                  create a course
                                </p>
                              </motion.div>
                            )}

                            {sourceType === "url-advanced" && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                key="url-advanced-input"
                              >
                                <Input
                                  label="Documentation URL"
                                  placeholder="https://react.dev/learn"
                                  value={documentationUrl}
                                  onChange={(e) =>
                                    setDocumentationUrl(e.target.value)
                                  }
                                  description="Select specific pages after site preview"
                                  size="lg"
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {error && (
                          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                            {error}
                          </div>
                        )}

                        <div className="flex gap-3 pt-4">
                          <Button
                            color="primary"
                            size="lg"
                            onPress={handleCreateCourse}
                            startContent={<Plus size={18} />}
                            isLoading={isLoading}
                            isDisabled={isLoading}
                          >
                            {isLoading ? "Creating..." : "Create Course"}
                          </Button>
                          <Button
                            variant="flat"
                            size="lg"
                            onPress={() => {
                              setFormData({
                                title: "",
                                description: "",
                                category: "",
                              });
                              setErrors({});
                            }}
                          >
                            Clear Form
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </Tab>
              </Tabs>
            </CardBody>
          </Card>
        </div>

        <EditCourseModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedCourse(null);
          }}
          course={selectedCourse}
        />

        <GoogleDriveFilePicker
          isOpen={showFilePickerDialog}
          onClose={() => setShowFilePickerDialog(false)}
          onSelectFiles={(fileIds) => {
            setSelectedDriveFiles(fileIds);
            setShowFilePickerDialog(false);
          }}
        />

        {/* Notification Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-4 right-4 z-50 max-w-md"
            >
              <div
                className={`p-4 rounded-lg shadow-lg ${
                  notification.type === "error"
                    ? "bg-red-500 text-white"
                    : "bg-green-500 text-white"
                }`}
              >
                <p className="font-medium">{notification.message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </Layout>
  );
}
