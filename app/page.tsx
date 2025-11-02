"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store/useStore";
import { authService } from "@/lib/services/auth";

export default function Home() {
  const router = useRouter();
  const { onboardingCompleted } = useStore();

  useEffect(() => {
    const currentUser = authService.getCurrentUser();

    if (!currentUser) {
      router.replace("/login");
    } else if (!onboardingCompleted) {
      router.replace("/onboarding");
    } else {
      router.replace("/courses");
    }
  }, [onboardingCompleted, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
