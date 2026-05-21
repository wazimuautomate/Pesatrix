"use client";

import { ThemeProvider } from "next-themes";
import { QueryProvider } from "./query-provider";
import { Toaster } from "sonner";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryProvider>
        <SkeletonTheme
          baseColor="hsl(var(--muted))"
          highlightColor="hsl(var(--accent))"
          duration={1.5}
        >
          {children}
        </SkeletonTheme>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            className: "font-sans",
          }}
        />
      </QueryProvider>
    </ThemeProvider>
  );
}
