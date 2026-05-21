import { Card, CardContent } from "@/components/ui/card";

export default function LoadingWazimPage() {
  return (
    <div className="space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      <div className="rounded-2xl border border-outline-variant/40 bg-white/70 px-5 py-4 shadow-sm shadow-navy/5">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border border-outline-variant/40 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 h-2 w-14 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-8 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-outline-variant/40 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 w-full animate-pulse rounded-xl bg-muted" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
