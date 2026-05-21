"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check, Copy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ReferralActions({
  referralLink,
}: {
  referralLink: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copied!");
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopy() {
    try {
      await copyLink();
    } catch {
      toast.error("Unable to copy the referral link.");
    }
  }

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join Pesatrix",
          text: "Join Pesatrix using my referral link:",
          url: referralLink,
        });
        return;
      }

      await copyLink();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      toast.error("Unable to share the referral link.");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <motion.div whileTap={{ scale: 0.95 }}>
        <Button variant="outline" title="Copy link" onClick={handleCopy}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          Copy
        </Button>
      </motion.div>
      <motion.div whileTap={{ scale: 0.95 }}>
        <Button variant="outline" onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      </motion.div>
    </div>
  );
}
