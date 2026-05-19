import { Card, CardContent } from "@/components/ui/card";

export default function LoadingReferralsPage() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <Card><CardContent className="h-28 animate-pulse pt-6" /></Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}><CardContent className="h-24 animate-pulse pt-6" /></Card>
        ))}
      </div>
    </div>
  );
}
