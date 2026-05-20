import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const footerLinks = {
  Platform: [
    { href: "/how-it-works", label: "How It Works" },
    { href: "/tasks", label: "Tasks" },
    { href: "/training", label: "Training" },
    { href: "/transparency", label: "Transparency" },
  ],
  Support: [
    { href: "/faq", label: "FAQ" },
    { href: "/dashboard/support", label: "Help Center" },
    { href: "/tulivu", label: "Tulivu" },
  ],
  Legal: [
    { href: "/terms", label: "Terms of Service" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/refund", label: "Refund Policy" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-surface pt-24 pb-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4 lg:gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 flex flex-col items-start">
            <Link href="/" className="flex items-center gap-3 group">
              <BrandLogo size="footer" className="transition-transform group-hover:scale-105" />
              <span className="text-xl font-semibold tracking-tight text-navy font-display">
                Pesatrix
              </span>
            </Link>
            <p className="mt-6 text-sm text-on-surface-variant max-w-xs leading-relaxed">
              The architecture of modern earning. Real tasks, instant liquidity. Built for Kenya.
            </p>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-sm font-bold tracking-wider uppercase text-navy">
                {heading}
              </h4>
              <ul className="mt-6 space-y-4">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm font-medium text-on-surface-variant transition-colors hover:text-navy"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-24 flex flex-col items-center justify-between gap-6 sm:flex-row border-t-2 border-surface-container pt-8">
          <p className="text-sm font-medium text-on-surface-variant">
            &copy; {new Date().getFullYear()} Pesatrix. All rights reserved.
          </p>
          <p className="text-sm font-medium text-on-surface-variant">
            System engineered in Kenya.
          </p>
        </div>
      </div>
    </footer>
  );
}
