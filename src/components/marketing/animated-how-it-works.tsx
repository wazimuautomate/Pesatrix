"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

interface Step {
  icon: LucideIcon;
  title: string;
  desc: string;
  detail: string;
}

const fps = 30;
const loopSeconds = 8;
const totalFrames = fps * loopSeconds;

const steps: Step[] = [
  {
    icon: ShieldCheck,
    title: "Create your account",
    desc: "Sign up with your details so every earning account is tied to a real verified person.",
    detail: "Secure profile",
  },
  {
    icon: Smartphone,
    title: "Activate M-Pesa",
    desc: "Pay the small one-time fee to activate your account for training and task allocation.",
    detail: "Payment number",
  },
  {
    icon: BookOpenCheck,
    title: "Complete training",
    desc: "Learn the standards for task completion, review work, and task submissions before you start.",
    detail: "Guided lessons",
  },
  {
    icon: ClipboardCheck,
    title: "Work and withdraw",
    desc: "Finish available tasks accurately, then submit for review and get paid directly to M-Pesa.",
    detail: "KSh payout",
  },
];

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function bezierEaseOut(progress: number) {
  const t = clamp(progress);
  const inverse = 1 - t;

  return (
    3 * inverse * inverse * t * 1 +
    3 * inverse * t * t * 1 +
    t * t * t
  );
}

function remapFrame(frame: number, startSeconds: number, durationSeconds: number) {
  return bezierEaseOut(
    (frame - startSeconds * fps) / (durationSeconds * fps)
  );
}

function useRemotionTimeline() {
  const [frame, setFrame] = useState(totalFrames - 1);
  const containerRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef(false);
  const frameRef = useRef(totalFrames - 1);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setFrame(totalFrames - 1);
      return undefined;
    }

    const node = containerRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        activeRef.current = entry.isIntersecting;
      },
      { threshold: 0.28 }
    );

    if (node) {
      observer.observe(node);
    }

    let animationId = 0;
    let start = performance.now();

    const tick = (now: number) => {
      if (activeRef.current) {
        const elapsedSeconds = ((now - start) / 1000) % loopSeconds;
        const nextFrame = Math.round(elapsedSeconds * fps);
        frameRef.current = nextFrame;
        setFrame(nextFrame);
      } else {
        start = now - (frameRef.current / fps) * 1000;
      }

      animationId = window.requestAnimationFrame(tick);
    };

    animationId = window.requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationId);
    };
  }, []);

  return { frame, containerRef };
}

export function AnimatedHowItWorks() {
  const { frame, containerRef } = useRemotionTimeline();
  const activeIndex = Math.min(
    steps.length - 1,
    Math.floor((frame / totalFrames) * steps.length)
  );
  const railProgress = clamp(frame / (totalFrames - fps));

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      className="overflow-hidden bg-surface-container-low px-5 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <div className="lg:sticky lg:top-32">
          <h2 className="font-display text-4xl font-black leading-tight tracking-normal text-navy sm:text-5xl">
            Your path to earning.
          </h2>
          <p className="mt-5 max-w-md text-lg font-medium leading-relaxed text-on-surface-variant">
            We value quality. We train you, then pay you for accurate work that passes review.
          </p>

          <div className="mt-8 rounded-[8px] border border-outline-variant/25 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <span className="text-xs font-black uppercase text-on-surface-variant">
                Setup progress
              </span>
              <span className="text-xs font-black text-secondary">
                {Math.round(railProgress * 100)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-container">
              <div
                className="h-full rounded-full bg-secondary"
                style={{ width: `${railProgress * 100}%` }}
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {steps.map((step, index) => (
                <div
                  key={step.detail}
                  className="flex items-center gap-2 text-xs font-black text-navy"
                  style={{
                    opacity: index <= activeIndex ? 1 : 0.42,
                    transform: `translateY(${index <= activeIndex ? 0 : 4}px)`,
                  }}
                >
                  <CheckCircle2
                    className={
                      index <= activeIndex
                        ? "h-4 w-4 text-secondary"
                        : "h-4 w-4 text-outline"
                    }
                  />
                  {step.detail}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-6 top-4 hidden h-[calc(100%-2rem)] w-px bg-outline-variant/45 sm:block">
            <div
              className="w-px bg-pesatrix-blue"
              style={{ height: `${railProgress * 100}%` }}
            />
          </div>

          <div className="grid gap-4">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const enter = remapFrame(frame, 0.25 + index * 0.72, 0.68);
              const active = index === activeIndex;

              return (
                <article
                  key={step.title}
                  className="relative rounded-[8px] border bg-white p-6 shadow-sm sm:ml-16"
                  style={{
                    opacity: 0.4 + enter * 0.6,
                    transform: `translateY(${(1 - enter) * 22}px) scale(${
                      active ? 1.01 : 1
                    })`,
                    borderColor: active
                      ? "rgba(20, 99, 255, 0.44)"
                      : "rgba(195, 197, 216, 0.35)",
                    boxShadow: active
                      ? "0 24px 60px rgba(11, 31, 59, 0.14)"
                      : "0 1px 3px rgba(11, 31, 59, 0.06)",
                  }}
                >
                  <div
                    className="absolute -left-[4.25rem] top-7 hidden h-12 w-12 items-center justify-center rounded-[8px] border bg-white text-sm font-black text-pesatrix-blue shadow-sm sm:flex"
                    style={{
                      borderColor: active
                        ? "rgba(20, 99, 255, 0.5)"
                        : "rgba(195, 197, 216, 0.45)",
                    }}
                  >
                    0{index + 1}
                  </div>
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <span className="text-sm font-black text-pesatrix-blue sm:hidden">
                      0{index + 1}
                    </span>
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-[8px] text-pesatrix-blue"
                      style={{
                        backgroundColor: active
                          ? "rgba(20, 99, 255, 0.14)"
                          : "rgba(233, 237, 255, 0.92)",
                      }}
                    >
                      <StepIcon className="h-6 w-6" strokeWidth={2} />
                    </span>
                  </div>
                  <h3 className="text-xl font-black tracking-normal text-navy">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-on-surface-variant">
                    {step.desc}
                  </p>
                  <div
                    className="mt-5 flex items-center gap-2 text-xs font-black text-secondary"
                    style={{ opacity: active ? 1 : 0 }}
                  >
                    Current step
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
