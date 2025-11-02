"use client";

import { ReactNode, useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Button, Avatar } from "@heroui/react";
import { Home, BookOpen, Settings, Menu, X, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SettingsDialog from "./SettingsDialog";
import Chatbot from "./Chatbot";
import { useStore } from "@/lib/store/useStore";
import { authService } from "@/lib/services/auth";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { userProfile, updateUserProfile, setOnboardingCompleted, articles } =
    useStore();

  // Check authentication on mount
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser && pathname !== "/login") {
      router.push("/login");
    } else if (currentUser && userProfile.name !== currentUser.name) {
      // Sync user profile with auth service
      updateUserProfile({
        name: currentUser.name,
        email: currentUser.email,
      });
    }
  }, [pathname, router, userProfile.name, updateUserProfile]);

  const handleLogout = () => {
    authService.logout();
    setOnboardingCompleted(false);
    router.replace("/login");
  };

  const navItems = [
    { path: "/courses", label: "Courses", icon: BookOpen },
    { path: "/articles", label: "Articles", icon: Home },
  ];

  const isActive = (path: string) => pathname?.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => router.push("/onboarding")}
              className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Image
                src="/images/favicon-32x32.png"
                alt="Docuer Logo"
                width={32}
                height={32}
                priority
                className="w-8 h-8 bg-gradient-to-br from-blue-600 to-green-600 rounded-lg"
              />
              <span className="text-xl font-bold text-gray-900 dark:text-gray-50">
                Docuer
              </span>
            </button>

            <div className="hidden md:flex items-center gap-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                const isArticles = item.path === "/articles";
                const disabled = isArticles && articles.length === 0;

                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      if (disabled) return;
                      router.push(item.path);
                    }}
                    aria-disabled={disabled}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      disabled
                        ? "text-gray-400 bg-transparent cursor-not-allowed opacity-60"
                        : active
                          ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20 font-semibold"
                          : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Button
                isIconOnly
                variant="light"
                onPress={handleLogout}
                title="Logout"
              >
                <LogOut size={20} />
              </Button>
              <Button
                isIconOnly
                variant="light"
                onPress={() => setIsSettingsOpen(true)}
              >
                <Settings size={20} />
              </Button>
              <button
                onClick={() => router.push("/profile")}
                className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
              >
                <Avatar
                  src=""
                  name={userProfile.name}
                  size="sm"
                  className="cursor-pointer"
                />
              </button>
              <Button
                isIconOnly
                variant="light"
                className="md:hidden"
                onPress={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </Button>
            </div>
          </div>
        </nav>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
            >
              <div className="px-4 py-3 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  const isArticles = item.path === "/articles";
                  const disabled = isArticles && articles.length === 0;

                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        if (disabled) return;
                        router.push(item.path);
                        setIsMobileMenuOpen(false);
                      }}
                      aria-disabled={disabled}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        disabled
                          ? "text-gray-400 bg-transparent cursor-not-allowed opacity-60"
                          : active
                            ? "text-blue-600 bg-blue-50 font-semibold"
                            : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>{children}</main>

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <Chatbot />
    </div>
  );
}
