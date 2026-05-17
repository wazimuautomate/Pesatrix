import { Providers } from "@/providers";
import { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: {
    default: "Pesatrix | Real Tasks, Instant Payouts",
    template: "%s | Pesatrix",
  },
  description:
    "Complete digital tasks from global partners and get paid instantly to your M-Pesa mobile wallet. Kenya-first online earning platform.",
  keywords: [
    "online tasks Kenya",
    "earn money Kenya",
    "M-Pesa payouts",
    "digital tasks",
    "Pesatrix",
  ],
  openGraph: {
    type: "website",
    locale: "en_KE",
    siteName: "Pesatrix",
    title: "Pesatrix | Real Tasks, Instant Payouts",
    description:
      "Complete digital tasks from global partners and get paid instantly to your M-Pesa mobile wallet.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`min-h-screen font-sans antialiased bg-surface text-on-surface ${poppins.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
