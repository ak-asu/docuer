"use client";

import { HeroUIProvider } from "@heroui/react";
import { useStore } from "@/lib/store/useStore";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const { userPreferences } = useStore();

  useEffect(() => {
    const root = document.documentElement;
    if (userPreferences.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [userPreferences.theme]);

  return (
    <HeroUIProvider className={userPreferences.theme}>
      {children}
    </HeroUIProvider>
  );
}
