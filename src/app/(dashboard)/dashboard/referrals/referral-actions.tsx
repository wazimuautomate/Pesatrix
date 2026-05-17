"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, MessageCircleMore, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type ShareTarget = "email" | "whatsapp" | "facebook";

export function ReferralActions({
  referralLink,
}: {
  referralLink: string;
}) {
  const [expanded, setExpanded] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied.");
    } catch {
      toast.error("Unable to copy the referral link.");
    }
  }

  function openShare(target: ShareTarget) {
    const encodedLink = encodeURIComponent(referralLink);
    const text = encodeURIComponent("Join Pesatrix using my referral link:");
    const href =
      target === "email"
        ? `mailto:?subject=Join%20Pesatrix&body=${text}%20${encodedLink}`
        : target === "whatsapp"
          ? `https://wa.me/?text=${text}%20${encodedLink}`
          : `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`;

    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="icon" title="Copy link" onClick={handleCopy}>
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" title="Share options" onClick={() => setExpanded((current) => !current)}>
        <Share2 className="h-4 w-4" />
      </Button>
      {expanded ? (
        <>
          <Button variant="outline" onClick={() => openShare("email")}>
            <Mail className="mr-2 h-4 w-4" />
            Email
          </Button>
          <Button variant="outline" onClick={() => openShare("whatsapp")}>
            <MessageCircleMore className="mr-2 h-4 w-4" />
            WhatsApp
          </Button>
          <Button variant="outline" onClick={() => openShare("facebook")}>
            <Share2 className="mr-2 h-4 w-4" />
            Facebook
          </Button>
        </>
      ) : null}
    </div>
  );
}
