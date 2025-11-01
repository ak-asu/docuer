'use client';

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
  Select,
  SelectItem,
} from '@heroui/react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useState } from 'react';
import { useStore } from '@/lib/store/useStore';

const settingsSchema = z.object({
  theme: z.enum(['light', 'dark']),
  notifications: z.boolean(),
  courseReminders: z.boolean(),
  language: z.string().min(2),
});

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { userPreferences, updateUserPreferences } = useStore();
  const [settings, setSettings] = useState(userPreferences);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    try {
      settingsSchema.parse(settings);
      updateUserPreferences(settings);
      setError(null);
      onClose();
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      }
    }
  };

  const handleCancel = () => {
    setSettings(userPreferences);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      size="2xl"
      placement="center"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-sm text-gray-500 font-normal">Customize your learning experience</p>
        </ModalHeader>
        <ModalBody>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Appearance</h3>
              <Select
                label="Theme"
                selectedKeys={[settings.theme]}
                onChange={(e) => setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' })}
              >
                <SelectItem key="light">
                  Light
                </SelectItem>
                <SelectItem key="dark">
                  Dark
                </SelectItem>
              </Select>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Notifications</h3>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Enable Notifications</p>
                  <p className="text-sm text-gray-500">
                    Receive updates about your learning progress
                  </p>
                </div>
                <Switch
                  isSelected={settings.notifications}
                  onValueChange={(checked) =>
                    setSettings({ ...settings, notifications: checked })
                  }
                />
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Course Reminders</p>
                  <p className="text-sm text-gray-500">Get reminded to continue your courses</p>
                </div>
                <Switch
                  isSelected={settings.courseReminders}
                  onValueChange={(checked) =>
                    setSettings({ ...settings, courseReminders: checked })
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Language</h3>
              <Select
                label="Language"
                selectedKeys={[settings.language]}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              >
                <SelectItem key="en">
                  English
                </SelectItem>
                <SelectItem key="es">
                  Spanish
                </SelectItem>
                <SelectItem key="fr">
                  French
                </SelectItem>
                <SelectItem key="de">
                  German
                </SelectItem>
              </Select>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <p className="text-sm text-red-600">{error}</p>
              </motion.div>
            )}
          </motion.div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleCancel}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave}>
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
