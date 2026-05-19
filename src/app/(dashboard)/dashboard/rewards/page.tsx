import { Gift } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Daily Rewards",
};

export default function RewardsPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-outline-variant/40 shadow-lg">
        <CardContent className="pt-12 pb-12 flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 bg-surface-container-low rounded-full flex items-center justify-center animate-pulse">
            <Gift className="w-10 h-10 text-pesatrix-blue" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-navy">Coming Soon</h1>
            <p className="text-muted-foreground">
              Daily rewards and spin wheel will be available soon.
            </p>
          </div>
          <p className="text-sm text-on-surface-variant">
            You will be notified when the feature is live. Stay tuned for exciting rewards and surprises!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}