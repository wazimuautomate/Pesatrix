"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function FinanceChart({ data }: { data: Array<Record<string, unknown>> }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => `KSh ${Number(value).toLocaleString("en-KE")}`} />
          <Line type="monotone" dataKey="activationRevenue" name="Inflow" stroke="#0f6fff" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="withdrawalAmount" name="Outflow" stroke="#dc2626" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
