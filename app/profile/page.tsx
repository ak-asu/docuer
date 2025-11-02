"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Progress,
  Avatar,
  Button,
} from "@heroui/react";
import { motion } from "framer-motion";
import {
  User,
  Calendar,
  Award,
  TrendingUp,
  BookOpen,
  Target,
} from "lucide-react";
import { useStore } from "@/lib/store/useStore";
import EditProfileModal from "@/app/components/EditProfileModal";
import GoogleDriveIntegration from "@/app/components/GoogleDriveIntegration";
import Layout from "@/app/components/Layout";

export default function UserDetailPage() {
  const { userProfile, courses } = useStore();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const stats = [
    {
      label: "Articles Completed",
      value: userProfile.completedArticles,
      icon: BookOpen,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Courses In Progress",
      value: courses.length,
      icon: Target,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      label: "Current Streak",
      value: `${userProfile.currentStreak} days`,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      label: "Courses Completed",
      value: userProfile.completedCourses,
      icon: Award,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  const memberSince = new Date(userProfile.joinedDate).toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
    },
  );

  return (
    <Layout>
      <main
        className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8"
        role="main"
        aria-label="User profile"
      >
        <div className="max-w-6xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="shadow-lg">
              <CardBody className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  <Avatar
                    src=""
                    name={userProfile.name}
                    className="w-24 h-24 text-3xl"
                    isBordered
                    color="primary"
                  />
                  <div className="flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {userProfile.name}
                    </h1>
                    <p className="text-gray-600 mb-1 flex items-center justify-center md:justify-start gap-2">
                      <User size={16} />
                      {userProfile.email}
                    </p>
                    <p className="text-gray-500 flex items-center justify-center md:justify-start gap-2">
                      <Calendar size={16} />
                      Member since {memberSince}
                    </p>
                  </div>
                  <Button
                    color="primary"
                    variant="flat"
                    onPress={() => setIsEditModalOpen(true)}
                    aria-label="Edit profile"
                  >
                    Edit Profile
                  </Button>
                </div>
              </CardBody>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Your Statistics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 * index }}
                  >
                    <Card className="shadow-md hover:shadow-lg transition-shadow">
                      <CardBody className="p-6">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}
                          >
                            <Icon className={`w-6 h-6 ${stat.color}`} />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900">
                              {stat.value}
                            </p>
                            <p className="text-sm text-gray-600">
                              {stat.label}
                            </p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Course Progress
            </h2>
            <div className="space-y-4">
              {courses.map((course, index) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 * index }}
                >
                  <Card className="shadow-md">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start w-full">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {course.title}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {course.category}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            {course.completedArticles}/{course.totalArticles}{" "}
                            articles
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardBody className="pt-0">
                      <Progress
                        value={course.progress}
                        color="primary"
                        size="sm"
                        className="mb-2"
                      />
                      <p className="text-sm text-gray-600">
                        {course.progress}% complete
                      </p>
                    </CardBody>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Integrations
          </h2>
          <GoogleDriveIntegration />
        </div>

        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
        />
      </main>
    </Layout>
  );
}
