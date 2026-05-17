"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface StitchScreenEmbedProps {
  html: string;
  title: string;
}

export function StitchScreenEmbed({
  html,
  title,
}: StitchScreenEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(960);

  useEffect(() => {
    const resize = () => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentWindow?.document;

      if (!doc) {
        return;
      }

      const nextHeight = Math.max(
        doc.body?.scrollHeight ?? 0,
        doc.documentElement?.scrollHeight ?? 0,
        960
      );

      setHeight(nextHeight + 8);
    };

    const timers = [
      window.setTimeout(resize, 0),
      window.setTimeout(resize, 250),
      window.setTimeout(resize, 1000),
    ];

    window.addEventListener("resize", resize);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", resize);
    };
  }, [html]);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="bg-white"
      initial={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <iframe
        ref={iframeRef}
        className="block w-full border-0"
        onLoad={() => {
          const doc = iframeRef.current?.contentWindow?.document;

          if (!doc) {
            return;
          }

          const nextHeight = Math.max(
            doc.body?.scrollHeight ?? 0,
            doc.documentElement?.scrollHeight ?? 0,
            960
          );

          setHeight(nextHeight + 8);
        }}
        sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
        srcDoc={html}
        style={{ height }}
        title={title}
      />
    </motion.div>
  );
}
