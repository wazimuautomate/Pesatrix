import { Providers } from "@/providers";
import { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const poppins = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/poppins/files/poppins-latin-300-normal.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-poppins",
  display: "swap",
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
  icons: {
    icon: '/favicon.svg',
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
