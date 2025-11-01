'use client';

import { useState } from 'react';
import { Tabs, Tab, Card, CardBody, CardHeader, Button, Input, Textarea, Select, SelectItem, Progress } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpen, Edit, Trash2, Play } from 'lucide-react';
import { z } from 'zod';
import { useStore, Course } from '@/lib/store/useStore';
import EditCourseModal from '@/app/components/EditCourseModal';
import Layout from '@/app/components/Layout';
import { sanitizeInput } from '@/lib/utils/seo';

const courseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(1, 'Please select a category'),
});

type CourseFormData = z.infer<typeof courseSchema>;

export default function CoursesPage() {
  const { courses, addCourse, deleteCourse } = useStore();
  const [selectedTab, setSelectedTab] = useState('existing');
  const [formData, setFormData] = useState<CourseFormData>({
    title: '',
    description: '',
    category: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CourseFormData, string>>>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const categories = ['Frontend', 'Backend', 'DevOps', 'Data Science', 'Mobile', 'Design', 'Programming'];

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

  const handleCreateCourse = () => {
    try {
      courseSchema.parse(formData);
      const newCourse = {
        id: Date.now().toString(),
        ...formData,
        progress: 0,
        totalArticles: 10,
        completedArticles: 0,
        createdAt: new Date().toISOString(),
      };
      addCourse(newCourse);
      setFormData({ title: '', description: '', category: '' });
      setErrors({});
      setSelectedTab('existing');
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

  return (
    <Layout>
      <main className="min-h-screen bg-gray-50 p-4 md:p-8" role="main" aria-label="Courses management">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Courses</h1>
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
              <Tab key="existing" title={
                <div className="flex items-center gap-2">
                  <BookOpen size={18} />
                  <span>Existing Courses</span>
                </div>
              }>
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
                        <p className="text-gray-600 mb-4">No courses yet. Create your first course!</p>
                        <Button
                          color="primary"
                          onPress={() => setSelectedTab('create')}
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
                          >
                            <Card className="shadow-md hover:shadow-lg transition-shadow">
                              <CardHeader className="flex flex-col items-start pb-2">
                                <div className="flex justify-between items-start w-full mb-2">
                                  <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                      {course.category}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600 mt-2">{course.description}</p>
                              </CardHeader>
                              <CardBody className="pt-0">
                                <div className="space-y-3">
                                  <div>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="text-gray-600">Progress</span>
                                      <span className="font-semibold text-gray-900">{course.progress}%</span>
                                    </div>
                                    <Progress value={course.progress} color="primary" size="sm" />
                                  </div>
                                  <p className="text-sm text-gray-600">
                                    {course.completedArticles} of {course.totalArticles} articles completed
                                  </p>
                                  <div className="flex gap-2 pt-2">
                                    <Button
                                      color="primary"
                                      size="sm"
                                      startContent={<Play size={16} />}
                                      className="flex-1"
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
                                      onPress={() => handleDeleteCourse(course.id)}
                                      startContent={<Trash2 size={16} />}
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

              <Tab key="create" title={
                <div className="flex items-center gap-2">
                  <Plus size={18} />
                  <span>Create New</span>
                </div>
              }>
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
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Course</h2>
                        <p className="text-gray-600">Build a personalized learning path</p>
                      </div>

                      <Input
                        label="Course Title"
                        placeholder="e.g., Advanced React Patterns"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        isInvalid={!!errors.title}
                        errorMessage={errors.title}
                        size="lg"
                      />

                      <Textarea
                        label="Description"
                        placeholder="Describe what students will learn in this course..."
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        isInvalid={!!errors.description}
                        errorMessage={errors.description}
                        minRows={4}
                      />

                      <Select
                        label="Category"
                        placeholder="Select a category"
                        selectedKeys={formData.category ? [formData.category] : []}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        isInvalid={!!errors.category}
                        errorMessage={errors.category}
                      >
                        {categories.map((category) => (
                          <SelectItem key={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </Select>

                      <div className="flex gap-3 pt-4">
                        <Button
                          color="primary"
                          size="lg"
                          onPress={handleCreateCourse}
                          startContent={<Plus size={18} />}
                        >
                          Create Course
                        </Button>
                        <Button
                          variant="flat"
                          size="lg"
                          onPress={() => {
                            setFormData({ title: '', description: '', category: '' });
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
    </main>
    </Layout>
  );
}
