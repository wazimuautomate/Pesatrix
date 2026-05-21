"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-xl border border-outline-variant/20 text-on-surface hover:bg-surface-container"
        aria-label="Loading theme toggle"
        disabled
      >
        <div className="h-5 w-5 animate-pulse rounded-full bg-on-surface-variant/20" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-10 w-10 press-scale rounded-xl border border-outline-variant/20 text-on-surface hover:bg-surface-container active:scale-95 transition-all duration-200"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="h-[1.2rem] w-[1.2rem] text-amber-400 transition-transform duration-300" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem] text-navy transition-transform duration-300" />
      )}
    </Button>
  );
}
