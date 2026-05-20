import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/images/pesatrix.webp";

const sizeClasses = {
  auth: "h-16 w-16",
  compact: "h-7 w-7",
  sidebar: "h-10 w-10",
  sidebarExpanded: "h-11 w-11",
  topbar: "h-9 w-9",
  footer: "h-10 w-10",
} as const;

type BrandLogoProps = {
  size?: keyof typeof sizeClasses;
  inverted?: boolean;
  className?: string;
};

export function BrandLogo({
  size = "topbar",
  inverted = false,
  className,
}: BrandLogoProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt="Pesatrix"
      width={1018}
      height={960}
      priority={size === "auth"}
      className={cn(
        "shrink-0 object-contain",
        sizeClasses[size],
        inverted && "invert",
        className
      )}
    />
  );
}
