"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/brand-logo";

export function HomepageHeader() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      transition={{ type: "spring", stiffness: 115, damping: 20 }}
      className={`fixed left-1/2 top-4 z-50 w-[calc(100%-1rem)] max-w-5xl -translate-x-1/2 rounded-full border px-3 transition-all duration-300 sm:w-[calc(100%-1.5rem)] sm:px-6 ${
        isScrolled
          ? "border-outline-variant/45 bg-white/95 py-3 shadow-2xl shadow-navy/10 backdrop-blur-xl"
          : "border-white/50 bg-white/72 py-3.5 shadow-xl shadow-navy/5 backdrop-blur-md"
      }`}
      aria-label="Primary navigation"
    >
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <BrandLogo size="sidebar" />
          <span className="hidden truncate font-display text-xl font-black text-navy min-[360px]:block">
            Pesatrix
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="/#how-it-works"
            className="text-sm font-bold text-on-surface-variant transition-colors hover:text-navy"
          >
            How it works
          </Link>
          <Link
            href="/#testimonials"
            className="text-sm font-bold text-on-surface-variant transition-colors hover:text-navy"
          >
            Testimonials
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-full bg-pesatrix-blue px-4 text-sm font-black text-white shadow-lg shadow-pesatrix-blue/20 transition-transform active:scale-[0.98] sm:px-5"
          >
            Login
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

export function HomepageFooter() {
  return (
    <footer className="border-t border-outline-variant/20 bg-white px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center">
        <div className="flex flex-wrap justify-center gap-6">
          <Link
            href="/dashboard/support"
            className="text-sm font-bold text-on-surface-variant transition-colors hover:text-navy"
          >
            Support
          </Link>
          <Link
            href="/privacy"
            className="text-sm font-bold text-on-surface-variant transition-colors hover:text-navy"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-sm font-bold text-on-surface-variant transition-colors hover:text-navy"
          >
            Terms of Service
          </Link>
          <Link
            href="/faq"
            className="text-sm font-bold text-on-surface-variant transition-colors hover:text-navy"
          >
            FAQ
          </Link>
        </div>
        <p className="text-xs font-bold text-on-surface-variant/70">
          &copy; {new Date().getFullYear()} Pesatrix. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
