"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const lastActivity = useRef(Date.now());
  const hasSignedOut = useRef(false);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    const markActive = () => {
      lastActivity.current = Date.now();
    };

    const handleTimeout = async () => {
      if (hasSignedOut.current) {
        return;
      }

      if (Date.now() - lastActivity.current <= SESSION_TIMEOUT_MS) {
        return;
      }

      hasSignedOut.current = true;
      await supabaseRef.current.auth.signOut();
      sessionStorage.removeItem("pesatrix_session_active");
      router.push("/login");
      router.refresh();
    };

    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "touchstart", "click"];
    events.forEach((eventName) => window.addEventListener(eventName, markActive, { passive: true }));

    const interval = window.setInterval(() => {
      void handleTimeout();
    }, CHECK_INTERVAL_MS);

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, markActive));
      window.clearInterval(interval);
    };
  }, [router]);

  return <>{children}</>;
}
