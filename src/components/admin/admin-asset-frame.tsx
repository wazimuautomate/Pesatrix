"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type AdminAssetFrameProps = {
  html: string;
  title: string;
};

function measureFrameHeight(iframe: HTMLIFrameElement | null) {
  if (!iframe) {
    return 960;
  }

  try {
    const doc = iframe.contentDocument;

    if (!doc) {
      return 960;
    }

    return Math.max(
      doc.body?.scrollHeight ?? 0,
      doc.documentElement?.scrollHeight ?? 0,
      window.innerHeight
    );
  } catch {
    return 960;
  }
}

export function AdminAssetFrame({ html, title }: AdminAssetFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [frameHeight, setFrameHeight] = useState(960);

  useEffect(() => {
    const syncHeight = () => {
      setFrameHeight(measureFrameHeight(iframeRef.current));
    };

    syncHeight();

    const intervalId = window.setInterval(syncHeight, 1000);
    window.addEventListener("resize", syncHeight);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", syncHeight);
    };
  }, [html, loaded]);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-background"
      initial={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <iframe
        ref={iframeRef}
        className={`w-full border-0 transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => {
          setLoaded(true);
          setFrameHeight(measureFrameHeight(iframeRef.current));
        }}
        sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
        srcDoc={html}
        style={{ height: `${frameHeight}px` }}
        title={title}
      />
    </motion.div>
  );
}
