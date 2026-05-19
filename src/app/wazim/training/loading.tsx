import { Card, CardContent } from "@/components/ui/card";

export default function LoadingAdminTrainingPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}><CardContent className="h-24 animate-pulse p-5" /></Card>
        ))}
      </div>
      <Card><CardContent className="h-80 animate-pulse p-5" /></Card>
    </div>
  );
}
