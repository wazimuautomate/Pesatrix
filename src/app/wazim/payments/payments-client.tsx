"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, CheckCircle, Clock, XCircle, DollarSign, Activity, Receipt } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";

type Payment = {
  id: string;
  user_id: string;
  amount: number;
  phone: string;
  mpesa_receipt: string | null;
  status: "pending" | "paid" | "failed" | "reversed";
  paid_at: string | null;
  created_at: string;
  profiles?: { full_name: string | null; phone: string | null };
};

type Summary = {
  total_paid_count: number;
  total_revenue_ksh: number;
  total_withdrawn_ksh: number;
  net_ksh: number;
  pending_count: number;
  failed_count: number;
};

type DailyRevenue = {
  date: string;
  count: number;
  amount: number;
};

export function PaymentsClient() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [receiptInput, setReceiptInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchData = useCallback(async (tab: string, searchQuery: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== "all") params.set("status", tab);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/admin/payments?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      setPayments(data.payments || []);
      setSummary(data.summary || null);
      setDailyRevenue(data.daily_revenue || []);
    } catch {
      toast.error("Error loading payments data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeTab, search);
  }, [activeTab, fetchData]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchData(activeTab, search);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, activeTab, fetchData]);

  const handleVerifyOpen = (payment: Payment) => {
    setSelectedPayment(payment);
    setReceiptInput("");
    setNoteInput("");
    setVerifyModalOpen(true);
  };

  const handleViewReceipt = (payment: Payment) => {
    setViewingPayment(payment);
    setReceiptModalOpen(true);
  };

  const submitVerify = async () => {
    if (!selectedPayment) return;
    if (!receiptInput.trim()) {
      toast.error("M-Pesa receipt is required");
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch(`/api/admin/payments/${selectedPayment.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mpesaReceipt: receiptInput.trim(), note: noteInput }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify payment");
      }

      toast.success("Payment verified successfully!");
      setVerifyModalOpen(false);
      fetchData(activeTab, search);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const maxRevenue = Math.max(...(dailyRevenue.map((d) => d.amount) || [0]), 1000);

  return (
    <div className="space-y-6">
      {/* Top row stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-outline-variant/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton width={120} height={28} /> : `KSh ${summary?.total_revenue_ksh.toLocaleString() || 0}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isLoading ? <Skeleton width={80} height={12} /> : `${summary?.total_paid_count || 0} paid activations`}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-outline-variant/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid Out</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {isLoading ? <Skeleton width={120} height={28} /> : `KSh ${summary?.total_withdrawn_ksh.toLocaleString() || 0}`}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-outline-variant/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(!isLoading && (summary?.net_ksh || 0) >= 0) ? "text-green-500" : "text-red-500"}`}>
              {isLoading ? <Skeleton width={120} height={28} /> : `KSh ${summary?.net_ksh.toLocaleString() || 0}`}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-outline-variant/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {isLoading ? <Skeleton width={50} height={28} /> : (summary?.pending_count || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isLoading ? <Skeleton width={60} height={12} /> : `${summary?.failed_count || 0} failed`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue bar chart */}
      <Card className="col-span-4 border border-outline-variant/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-navy">Revenue Trend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          {isLoading ? (
            <div className="h-[180px] w-full px-4 mt-2">
              <Skeleton height="100%" borderRadius={4} />
            </div>
          ) : (
            <>
              <div className="h-[180px] w-full flex items-end gap-1 px-4 mt-2">
                {dailyRevenue.map((day, i) => {
                  const heightPct = (day.amount / maxRevenue) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-pesatrix-blue/20 hover:bg-pesatrix-blue transition-all relative group rounded-t-sm"
                      style={{ height: `${Math.max(heightPct, 2)}%` }}
                    >
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs p-1.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10 shadow-md">
                        {day.date} — KSh {day.amount.toLocaleString()} ({day.count})
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1 px-4 mt-1">
                {dailyRevenue.map((day, i) => (
                  <div key={i} className="flex-1 text-center">
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(day.date).getDate()}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tabs & Table */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by receipt or phone..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value="all" className="m-0 border border-outline-variant/40 shadow-sm rounded-lg bg-card">
          <PaymentTable
            payments={payments}
            isLoading={isLoading}
            onVerify={handleVerifyOpen}
            onViewReceipt={handleViewReceipt}
          />
        </TabsContent>
        <TabsContent value="paid" className="m-0 border border-outline-variant/40 shadow-sm rounded-lg bg-card">
          <PaymentTable
            payments={payments}
            isLoading={isLoading}
            onVerify={handleVerifyOpen}
            onViewReceipt={handleViewReceipt}
          />
        </TabsContent>
        <TabsContent value="pending" className="m-0 border border-outline-variant/40 shadow-sm rounded-lg bg-card">
          <PaymentTable
            payments={payments}
            isLoading={isLoading}
            onVerify={handleVerifyOpen}
            onViewReceipt={handleViewReceipt}
          />
        </TabsContent>
        <TabsContent value="failed" className="m-0 border border-outline-variant/40 shadow-sm rounded-lg bg-card">
          <PaymentTable
            payments={payments}
            isLoading={isLoading}
            onVerify={handleVerifyOpen}
            onViewReceipt={handleViewReceipt}
          />
        </TabsContent>
      </Tabs>

      {/* Manual Verify Modal */}
      <Dialog open={verifyModalOpen} onOpenChange={setVerifyModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Payment Verification</DialogTitle>
            <DialogDescription>
              Confirm that this user has paid the activation fee via M-Pesa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">User:</span> <strong>{selectedPayment?.profiles?.full_name || "Unknown"}</strong></p>
              <p><span className="text-muted-foreground">Phone:</span> {selectedPayment?.phone}</p>
              <p><span className="text-muted-foreground">Amount:</span> KSh {selectedPayment?.amount}</p>
              <p><span className="text-muted-foreground">Current status:</span> <Badge variant="outline" className="text-amber-600 border-amber-600/30">{selectedPayment?.status}</Badge></p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt">M-Pesa Receipt Number *</Label>
              <Input
                id="receipt"
                placeholder="e.g. QWE123RTY4"
                value={receiptInput}
                onChange={(e) => setReceiptInput(e.target.value.toUpperCase())}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Admin Note (Optional)</Label>
              <Input
                id="note"
                placeholder="Why is this being manually verified?"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyModalOpen(false)} disabled={isVerifying}>
              Cancel
            </Button>
            <Button onClick={submitVerify} disabled={isVerifying || !receiptInput.trim()}>
              {isVerifying ? "Verifying..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Receipt Modal */}
      <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">User:</span> <strong>{viewingPayment?.profiles?.full_name || "Unknown"}</strong></p>
              <p><span className="text-muted-foreground">Phone:</span> {viewingPayment?.phone}</p>
              <p><span className="text-muted-foreground">Amount:</span> KSh {viewingPayment?.amount}</p>
              <p><span className="text-muted-foreground">M-Pesa Receipt:</span> <span className="font-mono font-bold">{viewingPayment?.mpesa_receipt}</span></p>
              <p><span className="text-muted-foreground">Paid At:</span> {viewingPayment?.paid_at ? new Date(viewingPayment.paid_at).toLocaleString() : "-"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setReceiptModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentTable({
  payments,
  isLoading,
  onVerify,
  onViewReceipt,
}: {
  payments: Payment[];
  isLoading: boolean;
  onVerify: (payment: Payment) => void;
  onViewReceipt: (payment: Payment) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>M-Pesa Receipt</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Paid At</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : payments.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
              No payments found.
            </TableCell>
          </TableRow>
        ) : (
          payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="font-medium text-pesatrix-blue">
                {payment.profiles?.full_name || "Unknown"}
              </TableCell>
              <TableCell>{payment.phone}</TableCell>
              <TableCell>KSh {payment.amount}</TableCell>
              <TableCell>
                {payment.mpesa_receipt ? (
                  <span className="font-mono text-sm">{payment.mpesa_receipt}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {payment.status === "paid" && (
                  <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-200">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Paid
                  </Badge>
                )}
                {payment.status === "pending" && (
                  <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-500/10">
                    <Clock className="mr-1 h-3 w-3" />
                    Pending
                  </Badge>
                )}
                {payment.status === "failed" && (
                  <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-200">
                    <XCircle className="mr-1 h-3 w-3" />
                    Failed
                  </Badge>
                )}
                {payment.status === "reversed" && (
                  <Badge variant="secondary">Reversed</Badge>
                )}
              </TableCell>
              <TableCell>
                {payment.paid_at
                  ? new Date(payment.paid_at).toLocaleDateString()
                  : "-"}
              </TableCell>
              <TableCell className="text-right">
                {payment.status === "paid" ? (
                  <Button variant="ghost" size="sm" onClick={() => onViewReceipt(payment)}>
                    <Receipt className="mr-1 h-3.5 w-3.5" />
                    View Receipt
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onVerify(payment)}
                  >
                    Manual Verify
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
