"use client";

import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
} from "@heroui/react";
import { motion } from "framer-motion";
import { z } from "zod";
import { useStore, Course } from "@/lib/store/useStore";
import { sanitizeInput } from "@/lib/utils/seo";

const courseSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must be less than 500 characters"),
  category: z.string().min(1, "Please select a category"),
});

type CourseFormData = z.infer<typeof courseSchema>;

interface EditCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course | null;
}

export default function EditCourseModal({
  isOpen,
  onClose,
  course,
}: EditCourseModalProps) {
  const { updateCourse } = useStore();
  const [formData, setFormData] = useState<CourseFormData>({
    title: "",
    description: "",
    category: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof CourseFormData, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    "Frontend",
    "Backend",
    "DevOps",
    "Data Science",
    "Mobile",
    "Design",
    "Programming",
  ];

  const resetFormData = () => {
    if (course) {
      setFormData({
        title: course.title,
        description: course.description,
        category: course.category,
      });
    }
    setErrors({});
  };

  const handleInputChange = (field: keyof CourseFormData, value: string) => {
    // Sanitize input to prevent XSS
    const sanitizedValue = sanitizeInput(value);
    setFormData({ ...formData, [field]: sanitizedValue });
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  const handleSave = async () => {
    if (!course) return;

    try {
      setIsSubmitting(true);
      courseSchema.parse(formData);

      updateCourse(course.id, {
        title: formData.title,
        description: formData.description,
        category: formData.category,
      });

      setErrors({});
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      setIsSubmitting(false);
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

  const handleCancel = () => {
    resetFormData();
    onClose();
  };

  if (!course) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      size="2xl"
      placement="center"
      aria-labelledby="edit-course-title"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 id="edit-course-title" className="text-2xl font-bold">
            Edit Course
          </h2>
          <p className="text-sm text-gray-500 font-normal">
            Update course information
          </p>
        </ModalHeader>
        <ModalBody>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Input
              label="Course Title"
              placeholder="e.g., Advanced React Patterns"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              isInvalid={!!errors.title}
              errorMessage={errors.title}
              size="lg"
              isRequired
              aria-label="Course title"
            />

            <Textarea
              label="Description"
              placeholder="Describe what students will learn in this course..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              isInvalid={!!errors.description}
              errorMessage={errors.description}
              minRows={4}
              isRequired
              aria-label="Course description"
            />

            <Select
              label="Category"
              placeholder="Select a category"
              selectedKeys={formData.category ? [formData.category] : []}
              onChange={(e) => handleInputChange("category", e.target.value)}
              isInvalid={!!errors.category}
              errorMessage={errors.category}
              isRequired
              aria-label="Course category"
            >
              {categories.map((category) => (
                <SelectItem key={category}>{category}</SelectItem>
              ))}
            </Select>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Editing course details will not affect
                your progress or completed articles.
              </p>
            </div>
          </motion.div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="flat"
            onPress={handleCancel}
            isDisabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave} isLoading={isSubmitting}>
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
