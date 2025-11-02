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
} from "@heroui/react";
import { motion } from "framer-motion";
import { z } from "zod";
import { useStore } from "@/lib/store/useStore";
import { sanitizeInput } from "@/lib/utils/seo";

const profileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z.string().email("Please enter a valid email address"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EditProfileModal({
  isOpen,
  onClose,
}: EditProfileModalProps) {
  const { userProfile, updateUserProfile } = useStore();
  const [formData, setFormData] = useState<ProfileFormData>({
    name: userProfile.name,
    email: userProfile.email,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof ProfileFormData, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form data when userProfile changes (no setState in effect, just tracking external state)
  const resetFormData = () => {
    setFormData({
      name: userProfile.name,
      email: userProfile.email,
    });
    setErrors({});
  };

  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    // Sanitize input to prevent XSS
    const sanitizedValue = sanitizeInput(value);
    setFormData({ ...formData, [field]: sanitizedValue });
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  const handleSave = async () => {
    try {
      setIsSubmitting(true);
      profileSchema.parse(formData);

      updateUserProfile({
        name: formData.name,
        email: formData.email,
      });

      setErrors({});
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      if (err instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof ProfileFormData, string>> = {};
        err.issues.forEach((error: z.ZodIssue) => {
          const field = error.path[0] as keyof ProfileFormData;
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      size="2xl"
      placement="center"
      aria-labelledby="edit-profile-title"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 id="edit-profile-title" className="text-2xl font-bold">
            Edit Profile
          </h2>
          <p className="text-sm text-gray-500 font-normal">
            Update your personal information
          </p>
        </ModalHeader>
        <ModalBody>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Input
              label="Full Name"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              isInvalid={!!errors.name}
              errorMessage={errors.name}
              size="lg"
              isRequired
              aria-label="Full name"
            />

            <Input
              label="Email Address"
              placeholder="Enter your email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              isInvalid={!!errors.email}
              errorMessage={errors.email}
              size="lg"
              isRequired
              aria-label="Email address"
            />

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Your profile information is stored
                locally in your browser and is not shared with any server.
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
