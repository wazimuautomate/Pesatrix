"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Quote,
  Wallet,
} from "lucide-react";
import { AnimatedHowItWorks } from "@/components/marketing/animated-how-it-works";
import { HomepageFooter, HomepageHeader } from "@/components/marketing/homepage-chrome";

const stats = [
  { value: "10,000+", label: "Active earners" },
  { value: "250k+", label: "Paid out" },
  { value: "4.9/5", label: "Trust score" },
];

const testimonials = [
  {
    quote:
      "Honestly, I thought it was another time-waster, but the training actually taught me how to do surveys properly. I made my first withdrawal to M-Pesa last Tuesday. It is not a get-rich-quick thing, but it is consistent pocket money when I am free.",
    name: "Kevin Malei",
    initials: "KM",
  },
    {
    quote:
      " I was skeptical at first, but the training was straightforward and really prepared me for the tasks. I’ve been using it for a month now, and I’ve already withdrawn three times to M-Pesa. It’s a legit way to earn some extra cash on the side.",
    name: "Brighton Owino",
    initials: "BO",
  },
  {
    quote:
      "The best part is that there are low withdrawal limits. Whatever tasks I finish for the day, I can cash out instantly. The verification was strict, but once I got in, everything has been smooth.",
    name: "Sophiah Mercy.",
    initials: "SM",
  },
];

export default function LandingPage() {
  const frame = useHeroFrame();

  const badgeStyle = getHeroEntranceStyle(frame, 4, 18);
  const titleStyle = getHeroEntranceStyle(frame, 10, 22);
  const paragraphStyle = getHeroEntranceStyle(frame, 18, 18);
  const buttonStyle = getHeroEntranceStyle(frame, 26, 16);
  const payoutStyle = getHeroEntranceStyle(frame, 36, 20, 0.96);
  const iconStyle = getHeroEntranceStyle(frame, 48, 0, 0.82);
  const firstLineReveal = getRevealClip(frame, 12, 34);
  const secondLineReveal = getRevealClip(frame, 24, 36);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-navy selection:bg-teal-container selection:text-navy">
      <HomepageHeader />

      <main>
        <section className="relative flex min-h-[86svh] items-center overflow-hidden px-5 pb-12 pt-28 sm:px-8 lg:px-12">
          <Image
            src="/images/pesatrix-hero.webp"
            alt="Kenyan woman smiling after receiving a Pesatrix M-Pesa payment"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[58%_center]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.76)_42%,rgba(255,255,255,0.42)_100%)] md:bg-[linear-gradient(90deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.72)_34%,rgba(255,255,255,0.18)_68%,rgba(255,255,255,0.04)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(0deg,rgba(255,255,255,1)_0%,rgba(255,255,255,0)_100%)]" />

          <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,0.55fr)] lg:items-end">
            <div className="max-w-2xl">
              <motion.div
                style={badgeStyle}
                className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/88 px-4 py-2 text-xs font-black text-secondary shadow-lg shadow-navy/10 backdrop-blur"
              >
                <span
                  className="h-2 w-2 rounded-full bg-secondary"
                  style={{
                    transform: `scale(${0.78 + getLoopPulse(frame, 42) * 0.22})`,
                    opacity: 0.72 + getLoopPulse(frame, 42) * 0.28,
                  }}
                />
                Verified M-Pesa payouts
              </motion.div>

              <motion.h1
                style={titleStyle}
                className="font-display text-[2.7rem] font-black leading-[1.02] tracking-normal text-navy sm:text-6xl lg:text-7xl"
              >
                <span className="block overflow-hidden">
                  <span
                    className="block"
                    style={{ clipPath: `inset(0 ${100 - firstLineReveal}% 0 0)` }}
                  >
                    Reliable work.
                  </span>
                </span>
                <span className="block overflow-hidden text-secondary">
                  <span
                    className="block"
                    style={{ clipPath: `inset(0 ${100 - secondLineReveal}% 0 0)` }}
                  >
                    Real mobile pay.
                  </span>
                </span>
              </motion.h1>

              <motion.p
                style={paragraphStyle}
                className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-on-surface-variant sm:text-xl"
              >
                Stop falling for scams. Pesatrix trains you for real digital tasks, then pays your cleared earnings straight to M-Pesa.
              </motion.p>

              <motion.div
                style={buttonStyle}
                className="mt-9 flex flex-col gap-3 sm:flex-row"
              >
                <Link
                  href="/register"
                  className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-navy px-7 text-base font-black text-white shadow-2xl shadow-navy/20 transition-transform active:scale-[0.98] sm:w-auto"
                >
                  Create free account
                  <ArrowRight className="h-5 w-5" strokeWidth={2.6} />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex h-14 w-full items-center justify-center rounded-full border border-navy/20 bg-white/80 px-7 text-base font-black text-navy backdrop-blur transition-colors hover:bg-white sm:w-auto"
                >
                  See how it works
                </a>
              </motion.div>
            </div>

            <motion.div
              style={payoutStyle}
              className="ml-auto hidden w-full max-w-sm rounded-[8px] border border-white/70 bg-white/88 p-5 shadow-2xl shadow-navy/15 backdrop-blur md:block"
            >
              <div className="flex items-center gap-4">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-secondary/10"
                  style={iconStyle}
                >
                  <Wallet className="h-6 w-6 text-secondary" />
                </span>
                <div>
                  <p className="text-sm font-black text-white">
                    Latest payout
                  </p>
                  <p className="text-2xl font-black text-navy">KSh 1,275.00</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-outline-variant/30 pt-5">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <p className="text-lg font-black text-navy tabular-nums">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-xs font-bold leading-snug text-on-surface-variant">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="border-y border-outline-variant/20 bg-white px-5 py-8 sm:px-8">
          <div className="mx-auto grid max-w-5xl grid-cols-3 gap-4 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-2xl font-black tracking-normal text-navy sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs font-bold text-on-surface-variant sm:text-sm">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="testimonials"
          className="bg-surface-container-lowest px-5 py-20 sm:px-8 sm:py-28"
        >
          <div className="mx-auto max-w-4xl">
            <div className="max-w-3xl">
              <h2 className="font-display text-4xl font-black leading-tight tracking-normal text-navy sm:text-5xl">
                You should not have to guess if a site pays.
              </h2>
              <p className="mt-5 text-lg font-medium leading-relaxed text-on-surface-variant">
                Hear from students who completed the training and put in the work.
              </p>
            </div>

            <div className="mt-14 space-y-10">
              {testimonials.map((item) => (
                <motion.article
                  key={item.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.45 }}
                  className="relative border-t border-outline-variant/30 pt-10"
                >
                  <Quote
                    className="absolute left-0 top-10 h-8 w-8 text-pesatrix-blue/20"
                    strokeWidth={1.4}
                  />
                  <p className="pl-12 text-xl font-semibold leading-relaxed text-navy">
                    &quot;{item.quote}&quot;
                  </p>
                  <div className="mt-6 flex items-center gap-3 pl-12">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-black text-pesatrix-blue">
                      {item.initials}
                    </span>
                    <div>
                      <p className="font-black text-navy">{item.name}</p>
                      <p className="mt-1 flex items-center gap-1 text-sm font-bold text-on-surface-variant">
                        <CheckCircle2 className="h-4 w-4 text-secondary" />
                        Verified earner
                      </p>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <AnimatedHowItWorks />

        <section className="bg-white px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto flex max-w-5xl flex-col items-center rounded-[8px] bg-navy px-6 py-14 text-center shadow-2xl shadow-navy/15 sm:px-12">
            <h2 className="font-display text-4xl font-black leading-tight tracking-normal text-white sm:text-5xl">
              Start with training. Earn with confidence.
            </h2>
            <p className="mt-5 max-w-2xl text-lg font-medium leading-relaxed text-surface-dim">
              Create your Pesatrix account, complete the guided setup, and use your M-Pesa number for direct payouts.
            </p>
            <Link
              href="/register"
              className="mt-8 inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white px-8 text-base font-black text-navy transition-transform active:scale-[0.98] sm:w-auto"
            >
              Create account
              <ArrowRight className="h-5 w-5" strokeWidth={2.6} />
            </Link>
          </div>
        </section>
      </main>

      <HomepageFooter />
    </div>
  );
}

const HERO_FPS = 30;

function useHeroFrame() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let animationId = 0;

    const tick = (now: number) => {
      setFrame(Math.floor(((now - start) / 1000) * HERO_FPS));
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationId);
  }, []);

  return frame;
}

function getHeroEntranceStyle(
  frame: number,
  startFrame: number,
  distance: number,
  startScale = 1,
) {
  const progress = interpolateFrame(frame, startFrame, startFrame + 24);
  const scale = startScale + (1 - startScale) * progress;
  const y = distance * (1 - progress);

  return {
    opacity: progress,
    transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
  };
}

function getRevealClip(frame: number, startFrame: number, endFrame: number) {
  return interpolateFrame(frame, startFrame, endFrame) * 100;
}

function getLoopPulse(frame: number, durationFrames: number) {
  const cycle = (frame % durationFrames) / durationFrames;
  return Math.sin(cycle * Math.PI);
}

function interpolateFrame(frame: number, startFrame: number, endFrame: number) {
  const raw = (frame - startFrame) / (endFrame - startFrame);
  const clamped = Math.min(Math.max(raw, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}
