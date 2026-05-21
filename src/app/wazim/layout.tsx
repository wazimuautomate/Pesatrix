export const metadata = {
  title: "Pesatrix Wazim Admin",
  description: "Pesatrix Wazim administration portal",
};

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
