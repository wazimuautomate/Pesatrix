"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import DOMPurify from "dompurify";
import { createClient } from "@/lib/supabase/client";

export type Banner = {
  id: string;
  title: string;
  message: string;
  type: "info" | "urgent" | "warning" | "success" | "fraud";
  target: "all" | "activated" | "specific_user";
  is_dismissible: boolean;
};

const BANNER_CONFIG = {
  urgent: {
    bg: "bg-red-50",
    border: "border-red-400",
    text: "text-red-900",
    iconColor: "text-red-600",
    Icon: AlertCircle,
  },
  fraud: {
    bg: "bg-red-100",
    border: "border-red-600",
    text: "text-red-950",
    iconColor: "text-red-700",
    Icon: AlertCircle,
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-400",
    text: "text-amber-900",
    iconColor: "text-amber-600",
    Icon: AlertTriangle,
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-400",
    text: "text-blue-900",
    iconColor: "text-blue-600",
    Icon: Info,
  },
  success: {
    bg: "bg-green-50",
    border: "border-green-400",
    text: "text-green-900",
    iconColor: "text-green-600",
    Icon: CheckCircle,
  },
};

const getSortWeight = (type: string) => {
  if (type === "fraud" || type === "urgent") return 3;
  if (type === "warning" || type === "info") return 2;
  return 1; // success
};

export function BannerStrip() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchBanners() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("banners")
        .select("id, title, message, type, target, is_dismissible")
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching banners:", error);
        if (mounted) setIsLoading(false);
        return;
      }

      if (data && mounted) {
        const dismissedStr = localStorage.getItem("pesatrix_dismissed_banners");
        const dismissedIds = dismissedStr ? JSON.parse(dismissedStr) : [];
        
        const activeBanners = (data as Banner[])
          .filter((b) => !dismissedIds.includes(b.id))
          .sort((a, b) => getSortWeight(b.type) - getSortWeight(a.type));

        setBanners(activeBanners);
        setIsLoading(false);
      }
    }

    fetchBanners();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [banners.length]);

  if (isLoading || banners.length === 0) return null;

  const currentBanner = banners[currentIndex];
  if (!currentBanner) return null;

  const config = BANNER_CONFIG[currentBanner.type] || BANNER_CONFIG.info;
  const Icon = config.Icon;
  const sanitizedMessage = sanitizeBannerHtml(currentBanner.message);

  const dismissBanner = (id: string) => {
    const dismissedStr = localStorage.getItem("pesatrix_dismissed_banners");
    const dismissedIds: string[] = dismissedStr ? JSON.parse(dismissedStr) : [];
    dismissedIds.push(id);
    localStorage.setItem("pesatrix_dismissed_banners", JSON.stringify(dismissedIds));

    setBanners((prev) => prev.filter((b) => b.id !== id));
    if (currentIndex >= banners.length - 1) {
      setCurrentIndex(0);
    }
  };

  const showPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const showNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBanner.id}
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          className={`w-full border-b px-4 py-3 sm:px-6 lg:px-8 ${config.bg} ${config.border} ${config.text}`}
        >
          <div className="mx-auto flex max-w-[1440px] items-start gap-3">
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconColor}`} />
            {banners.length > 1 && (
              <button
                onClick={showPrevious}
                className={`mt-0.5 shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5 ${config.iconColor}`}
                aria-label="Previous banner"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">{currentBanner.title}</h3>
              {sanitizedMessage ? (
                <div
                  className="banner-content prose prose-sm mt-1 max-w-none opacity-90 prose-a:font-semibold prose-a:underline prose-ul:my-1 prose-ol:my-1 prose-p:my-0"
                  dangerouslySetInnerHTML={{ __html: sanitizedMessage }}
                />
              ) : null}
            </div>

            {banners.length > 1 && (
              <button
                onClick={showNext}
                className={`mt-0.5 shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5 ${config.iconColor}`}
                aria-label="Next banner"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {currentBanner.is_dismissible && (
              <button
                onClick={() => dismissBanner(currentBanner.id)}
                className={`ml-3 shrink-0 rounded-lg p-1 hover:bg-black/5 transition-colors ${config.iconColor}`}
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {banners.length > 1 && (
            <div className="mx-auto max-w-[1440px] mt-2 flex justify-center gap-1.5">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentIndex
                      ? "w-4 bg-black/40"
                      : "w-1.5 bg-black/15 hover:bg-black/25"
                  }`}
                  onClick={() => setCurrentIndex(idx)}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function sanitizeBannerHtml(value: string | null | undefined) {
  if (!value || typeof window === "undefined") return "";

  const clean = DOMPurify.sanitize(value, {
    ADD_ATTR: ["target", "rel"],
  });
  const template = document.createElement("template");
  template.innerHTML = clean;
  template.content.querySelectorAll("a").forEach((link) => {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });

  return template.innerHTML;
}
