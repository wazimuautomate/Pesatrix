import { Card, CardContent } from "@/components/ui/card";

export default function LoadingAdminReferralsPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}><CardContent className="h-24 animate-pulse pt-6" /></Card>
        ))}
      </div>
      <Card><CardContent className="h-40 animate-pulse pt-6" /></Card>
      <Card><CardContent className="h-72 animate-pulse pt-6" /></Card>
    </div>
  );
}
