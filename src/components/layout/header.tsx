"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/tasks", label: "Tasks" },
  { href: "/training", label: "Training" },
  { href: "/faq", label: "FAQ" },
  { href: "/support", label: "Support" },
];

export function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy transition-transform group-hover:scale-105">
            <span className="text-base font-bold text-white font-display">P</span>
          </div>
          <span className="text-xl font-semibold tracking-tight text-navy font-display">
            Pesatrix
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-navy"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-4 md:flex">
          <Link href="/login" className="text-sm font-semibold text-navy hover:text-pesatrix-blue transition-colors px-2">
            Sign In
          </Link>
          <Button asChild className="rounded-full px-6">
            <Link href="/register">
              Initialize
            </Link>
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-12 w-12 items-center justify-center rounded-xl text-navy bg-surface-container-low md:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-20 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-outline-variant/20 shadow-2xl md:hidden"
          >
            <nav className="flex flex-col gap-2 px-6 py-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-4 py-3 text-lg font-semibold text-navy transition-colors hover:bg-surface-container-low"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-6 flex flex-col gap-3 pt-6 border-t border-outline-variant/20">
                <Button variant="outline" size="lg" asChild className="w-full rounded-xl">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button size="lg" asChild className="w-full rounded-xl">
                  <Link href="/register">Initialize</Link>
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
