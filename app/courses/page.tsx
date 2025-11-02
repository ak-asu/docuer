"use client";

import { useState, useEffect } from "react";
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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Checkbox,
} from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, BookOpen, Edit, Trash2, Play } from "lucide-react";
import { z } from "zod";
import { useStore, useAuthCheck, Course } from "@/lib/store/useStore";
import { authService } from "@/lib/services/auth";
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

  // Advanced URL flow state
  const [urlPreview, setUrlPreview] = useState<{
    mainUrl: string;
    title: string;
    description: string;
    siteMap: string[];
    totalPages: number;
    preSelectedUrls?: string[];
  } | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [processingStage, setProcessingStage] = useState<
    "idle" | "fetching-preview" | "selecting" | "creating-course"
  >("idle");
  const [processingMessage, setProcessingMessage] = useState("");

  const { shouldCheckAuth, onboardingCompleted: isOnboardingCompleted } =
    useAuthCheck();

  useEffect(() => {
    // Wait for store to hydrate before checking
    if (!shouldCheckAuth) return;

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      router.replace("/login");
      return;
    }
    if (!isOnboardingCompleted) {
      router.replace("/onboarding");
      return;
    }
  }, [router, isOnboardingCompleted, shouldCheckAuth]);

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
        // Simple URL flow - create course directly
        await createCourseFromUrl(
          documentationUrl,
          formData.title,
          formData.description,
          formData.category,
        );
        // Reset form and switch to existing tab after success
        setFormData({ title: "", description: "", category: "" });
        setDocumentationUrl("");
        setSourceType("url");
        setErrors({});
        setSelectedTab("existing");
      } else if (sourceType === "gdrive" && selectedDriveFiles.length > 0) {
        // Google Drive flow - TODO
        showNotification(
          "success",
          `Google Drive integration - ${selectedDriveFiles.length} file(s) selected for import`,
        );
      } else if (sourceType === "url-advanced" && documentationUrl) {
        // Advanced URL flow - two-phase: preview then select
        await handleAdvancedUrlFlow();
      }
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

  const handleAdvancedUrlFlow = async () => {
    try {
      // Phase 1: Fetch preview
      setProcessingStage("fetching-preview");
      setProcessingMessage("Analyzing documentation structure...");

      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      const response = await fetch("/api/courses/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: documentationUrl,
          userId: currentUser.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch preview");
      }

      const previewData = await response.json();

      // Set preview data and show modal
      setUrlPreview({
        mainUrl: documentationUrl,
        title: previewData.title,
        description: previewData.description,
        siteMap: previewData.siteMap,
        totalPages: previewData.totalPages,
        preSelectedUrls: previewData.preSelectedUrls || [],
      });

      // Pre-select AI-recommended URLs by default
      setSelectedUrls(previewData.preSelectedUrls || []);

      // Show modal for user selection
      setProcessingStage("selecting");
      setShowPreviewModal(true);
      setProcessingMessage("");
    } catch (error) {
      setProcessingStage("idle");
      setProcessingMessage("");
      showNotification(
        "error",
        error instanceof Error ? error.message : "Failed to fetch preview",
      );
    }
  };

  const handleConfirmUrlSelection = async () => {
    if (selectedUrls.length === 0) {
      showNotification("error", "Please select at least one page");
      return;
    }

    try {
      // Close modal and start processing
      setShowPreviewModal(false);
      setProcessingStage("creating-course");
      setProcessingMessage(
        `Creating course from ${selectedUrls.length} selected pages...`,
      );

      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      const response = await fetch("/api/courses/create-advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedUrls,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          userId: currentUser.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create course");
      }

      const data = await response.json();

      if (data.success) {
        // Add course and articles to store
        const { addCourse: addCourseToStore, addArticles } =
          useStore.getState();
        addCourseToStore(data.course);
        addArticles(data.articles);

        // Reset everything
        setFormData({ title: "", description: "", category: "" });
        setDocumentationUrl("");
        setSourceType("url");
        setErrors({});
        setUrlPreview(null);
        setSelectedUrls([]);
        setProcessingStage("idle");
        setProcessingMessage("");

        // Show success and switch to existing tab
        showNotification("success", "Course created successfully!");
        setSelectedTab("existing");
      }
    } catch (error) {
      setProcessingStage("idle");
      setProcessingMessage("");
      showNotification(
        "error",
        error instanceof Error ? error.message : "Failed to create course",
      );
    }
  };

  const handleCancelUrlSelection = () => {
    setShowPreviewModal(false);
    setUrlPreview(null);
    setSelectedUrls([]);
    setProcessingStage("idle");
    setProcessingMessage("");
  };

  const handleDeleteCourse = async (id: string) => {
    await deleteCourse(id);
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
                            isLoading={isLoading || processingStage !== "idle"}
                            isDisabled={isLoading || processingStage !== "idle"}
                          >
                            {isLoading || processingStage !== "idle"
                              ? "Processing..."
                              : "Create Course"}
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

        {/* Processing Overlay */}
        {(processingStage === "fetching-preview" ||
          processingStage === "creating-course") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <Card className="max-w-md w-full mx-4">
              <CardBody className="p-8 text-center">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {processingStage === "fetching-preview"
                    ? "Analyzing Documentation"
                    : "Creating Course"}
                </h3>
                <p className="text-gray-600">{processingMessage}</p>
              </CardBody>
            </Card>
          </motion.div>
        )}

        {/* URL Preview Modal */}
        <Modal
          isOpen={showPreviewModal}
          onClose={handleCancelUrlSelection}
          size="5xl"
          scrollBehavior="inside"
        >
          <ModalContent>
            {() => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold">
                    Select Pages to Include
                  </h2>
                  <p className="text-sm text-gray-600">
                    {urlPreview?.title} - {urlPreview?.totalPages} pages found
                  </p>
                </ModalHeader>
                <ModalBody>
                  <div className="space-y-4">
                    {/* Select All / Deselect All */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">
                          {selectedUrls.length} of{" "}
                          {urlPreview?.siteMap.length || 0} pages selected
                        </p>
                        <p className="text-sm text-gray-600">
                          {urlPreview?.preSelectedUrls &&
                            urlPreview.preSelectedUrls.length > 0 && (
                              <span className="text-blue-600">
                                {urlPreview.preSelectedUrls.length} pages
                                personalized for you •
                              </span>
                            )}{" "}
                          Estimated time: ~
                          {Math.ceil((selectedUrls.length * 2) / 60)} min
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() =>
                            setSelectedUrls(urlPreview?.siteMap || [])
                          }
                        >
                          Select All
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() =>
                            setSelectedUrls(urlPreview?.preSelectedUrls || [])
                          }
                        >
                          Smart Selection
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => setSelectedUrls([])}
                        >
                          Deselect All
                        </Button>
                      </div>
                    </div>

                    {/* Single URL List */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {urlPreview?.siteMap.map((url, index) => {
                        const isPreSelected =
                          urlPreview.preSelectedUrls?.includes(url);
                        return (
                          <div
                            key={index}
                            className={`flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors ${
                              isPreSelected
                                ? "border-2 border-blue-200 bg-blue-50/50"
                                : "border border-gray-200"
                            }`}
                          >
                            <Checkbox
                              isSelected={selectedUrls.includes(url)}
                              onValueChange={(checked) => {
                                if (checked) {
                                  setSelectedUrls([...selectedUrls, url]);
                                } else {
                                  setSelectedUrls(
                                    selectedUrls.filter((u) => u !== url),
                                  );
                                }
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p
                                  className={`text-sm truncate ${isPreSelected ? "font-medium text-blue-900" : "text-gray-700"}`}
                                >
                                  {url.replace(urlPreview.mainUrl, "") || "/"}
                                </p>
                                {isPreSelected && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full shrink-0">
                                    Recommended
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">
                                {url}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedUrls.length > 100 && (
                      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-sm text-orange-800">
                          ⚠️ Warning: Selecting {selectedUrls.length} pages may
                          take a significant amount of time to process. Consider
                          selecting fewer pages for faster course creation.
                        </p>
                      </div>
                    )}
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={handleCancelUrlSelection}>
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    onPress={handleConfirmUrlSelection}
                    isDisabled={selectedUrls.length === 0}
                  >
                    Create Course ({selectedUrls.length} pages)
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </main>
    </Layout>
  );
}
