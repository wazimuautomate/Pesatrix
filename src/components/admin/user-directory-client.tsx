"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Eye,
  ShieldAlert,
  ShieldX,
  ShieldCheck,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Wallet,
  CheckCircle2,
  XCircle,
  MapPin,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  ClipboardList,
  Edit3,
  MessageCircle,
  MoreVertical,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Skeleton from "react-loading-skeleton";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/admin/admin-native";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  county: string | null;
  created_at: string;
  status: string;
  is_activated: boolean;
  activated_at: string | null;
  is_setup_complete: boolean;
  available_balance?: number;
  pending_balance?: number;
  activated_referrals_count?: number;
};

type WalletSummary = {
  available_balance: number;
  pending_balance: number;
  total_earned: number;
};

type UserDetail = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  county: string | null;
  created_at: string;
  status: string;
  is_activated: boolean;
  activated_at: string | null;
  is_setup_complete: boolean;
  wallet: WalletSummary | null;
  verification: {
    phone_verified: boolean;
    email_verified: boolean;
    kyc_status: string;
    risk_score: number;
  } | null;
};

type Stats = {
  total: number;
  activated: number;
  suspended: number;
  banned: number;
};

type ApiResponse = {
  users: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZE = 50;

export function UserDirectoryClient({
  initialUsers,
  initialStats,
  initialPage,
  initialSearch,
  currentAdminId,
}: {
  initialUsers: UserRow[];
  initialStats: Stats;
  initialPage: number;
  initialSearch: string;
  currentAdminId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(Math.ceil(initialStats.total / PAGE_SIZE));
  const [search, setSearch] = useState(initialSearch);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: "suspend" | "ban" | "unblock" | "delete";
    userId: string;
    userName: string;
    reason: string;
    loading: boolean;
  }>({ open: false, action: "suspend", userId: "", userName: "", reason: "", loading: false });

  const fetchData = useCallback(async (pageNum: number, searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(pageNum));
      if (searchTerm) qs.set("search", searchTerm);

      const res = await fetch(`/api/admin/users?${qs.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }
      const data: ApiResponse = await res.json();
      setUsers(data.users);
      setTotalPages(data.totalPages);
    } catch {
      setError("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData(1, searchInput);
    setSearch(searchInput);

    const qs = new URLSearchParams();
    if (searchInput) qs.set("q", searchInput);
    router.push(`/wazim/users${qs.toString() ? `?${qs.toString()}` : ""}`);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchData(newPage, search);

    const qs = new URLSearchParams();
    qs.set("page", String(newPage));
    if (search) qs.set("q", search);
    router.push(`/wazim/users?${qs.toString()}`);
  };

  const openDetail = async (userId: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch user detail");
      const data = await res.json();
      setDetailUser({
        id: data.profile.id,
        full_name: data.profile.full_name,
        phone: data.profile.phone,
        email: data.profile.email,
        county: data.profile.county,
        created_at: data.profile.created_at,
        status: data.status?.status ?? "registered",
        is_activated: data.status?.is_activated ?? false,
        activated_at: data.status?.activated_at ?? null,
        is_setup_complete: data.status?.is_setup_complete ?? false,
        wallet: data.wallet,
        verification: data.verification
          ? {
              phone_verified: data.verification.phone_verified ?? false,
              email_verified: data.verification.email_verified ?? false,
              kyc_status: data.verification.kyc_status ?? "not_started",
              risk_score: data.verification.risk_score ?? 0,
            }
          : null,
      });
    } catch {
      toast.error("Failed to load user details");
    } finally {
      setDetailLoading(false);
    }
  };

  const openAction = (action: "suspend" | "ban" | "unblock" | "delete", userId: string, userName: string) => {
    setActionDialog({ open: true, action, userId, userName, reason: "", loading: false });
  };

  const executeAction = async () => {
    if (!actionDialog.reason.trim() || actionDialog.reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters");
      return;
    }

    setActionDialog((prev) => ({ ...prev, loading: true }));

    const endpointMap = {
      suspend: `/api/admin/users/${actionDialog.userId}/suspend`,
      ban: `/api/admin/users/${actionDialog.userId}/ban`,
      unblock: `/api/admin/users/${actionDialog.userId}/unblock`,
      delete: `/api/admin/users/${actionDialog.userId}/delete`,
    };

    const bodyMap = {
      suspend: { action: "suspended", reason: actionDialog.reason.trim() },
      ban: { reason: actionDialog.reason.trim() },
      unblock: { reason: actionDialog.reason.trim() },
      delete: { reason: actionDialog.reason.trim() },
    };

    try {
      const res = await fetch(endpointMap[actionDialog.action], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyMap[actionDialog.action]),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action failed");
        return;
      }

      const labels = { suspend: "Suspended", ban: "Banned", unblock: "Unblocked", delete: "Deleted" };
      toast.success(`User ${labels[actionDialog.action]} successfully`);

      setActionDialog((prev) => ({ ...prev, open: false }));
      setDetailOpen(false);
      fetchData(page, search);
    } catch {
      toast.error("Network error — try again");
    } finally {
      setActionDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const isSelf = (userId: string) => userId === currentAdminId;
  const actionHref = (userId: string) => `/wazim/tasks?assignUser=${encodeURIComponent(userId)}`;

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats.total.toLocaleString()} detail="All registered accounts" tone="blue" />
        <StatCard label="Activated" value={stats.activated.toLocaleString()} detail="Completed activation" tone="teal" />
        <StatCard label="Suspended" value={stats.suspended.toLocaleString()} detail="Currently suspended" tone="amber" />
        <StatCard label="Banned" value={stats.banned.toLocaleString()} detail="Permanently banned" tone="red" />
      </section>

      <div className="mt-6 rounded-lg border border-outline-variant/40 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-outline-variant/30 p-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-navy">User Directory</h2>
          <form onSubmit={handleSearch} className="flex w-full gap-2 md:max-w-sm">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, phone, or email"
              className="flex-1"
            />
            <Button type="submit" size="sm" variant="outline">
              <Search className="mr-1 h-4 w-4" />
              Search
            </Button>
          </form>
        </div>

        {error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchData(page, search)}>
              Retry
            </Button>
          </div>
        ) : !loading && users.length === 0 ? (
          <EmptyState>No users found. Try adjusting your search.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activated</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Referrals</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableSkeleton rows={8} columns={11} />
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                      <TableCell>
                        <button
                          onClick={() => openDetail(user.id)}
                          className="font-semibold text-pesatrix-blue hover:underline text-left"
                        >
                          {user.full_name ?? "Unnamed user"}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm">{user.phone ?? "—"}</TableCell>
                      <TableCell className="text-sm">{user.email ?? "—"}</TableCell>
                      <TableCell className="text-sm">{user.county ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={user.status} />
                      </TableCell>
                      <TableCell>
                        {user.is_activated ? (
                          <span className="inline-flex items-center gap-1 text-teal">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="sr-only">Yes</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-muted-foreground">
                            <XCircle className="h-4 w-4" />
                            <span className="sr-only">No</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        KSh {Number(user.available_balance ?? 0).toLocaleString("en-KE")}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        KSh {Number(user.pending_balance ?? 0).toLocaleString("en-KE")}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {Number(user.activated_referrals_count ?? 0).toLocaleString("en-KE")}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(user.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" aria-label={`Actions for ${user.full_name ?? "user"}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => openDetail(user.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View quick summary
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/wazim/users/${user.id}`}>
                                  <Edit3 className="mr-2 h-4 w-4" />
                                  View profile
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/wazim/users/${user.id}?adjust=1`}>
                                  <Wallet className="mr-2 h-4 w-4" />
                                  Adjust balance
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/wazim/activity?user_id=${encodeURIComponent(user.id)}`}>
                                  <ClipboardList className="mr-2 h-4 w-4" />
                                  View activity
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.phone && (
                                <>
                                  <DropdownMenuItem asChild>
                                    <a href={`tel:${normalizePhoneForTel(user.phone)}`}>
                                      <Phone className="mr-2 h-4 w-4" />
                                      Call user
                                    </a>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <a href={`https://wa.me/${normalizePhoneForWhatsApp(user.phone)}`} target="_blank" rel="noopener noreferrer">
                                      <MessageCircle className="mr-2 h-4 w-4" />
                                      WhatsApp
                                    </a>
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuItem asChild>
                                <Link href={actionHref(user.id)}>
                                  <ClipboardList className="mr-2 h-4 w-4" />
                                  Assign task
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.status !== "suspended" && user.status !== "banned" && !isSelf(user.id) && (
                                <DropdownMenuItem onClick={() => openAction("suspend", user.id, user.full_name ?? "User")}>
                                  <ShieldAlert className="mr-2 h-4 w-4 text-amber-600" />
                                  Suspend
                                </DropdownMenuItem>
                              )}
                              {user.status !== "suspended" && user.status !== "banned" && !isSelf(user.id) && (
                                <DropdownMenuItem onClick={() => openAction("ban", user.id, user.full_name ?? "User")}>
                                  <ShieldX className="mr-2 h-4 w-4 text-destructive" />
                                  Ban
                                </DropdownMenuItem>
                              )}
                              {(user.status === "suspended" || user.status === "banned") && !isSelf(user.id) && (
                                <DropdownMenuItem onClick={() => openAction("unblock", user.id, user.full_name ?? "User")}>
                                  <ShieldCheck className="mr-2 h-4 w-4 text-teal" />
                                  Restore access
                                </DropdownMenuItem>
                              )}
                              {!isSelf(user.id) && (
                                <DropdownMenuItem onClick={() => openAction("delete", user.id, user.full_name ?? "User")}>
                                  <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-outline-variant/30 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{detailUser?.full_name ?? "User Detail"}</span>
              <Button variant="ghost" size="icon" onClick={() => setDetailOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              {detailUser?.email ?? "No email"} · {detailUser?.phone ?? "No phone"}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton height={16} />
              <Skeleton height={16} width="75%" />
              <Skeleton height={16} width="50%" />
              <Skeleton height={80} />
            </div>
          ) : detailUser ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={detailUser.status} />
                {detailUser.is_activated && <Badge variant="success">Activated</Badge>}
                {detailUser.is_setup_complete && <Badge variant="secondary">Setup Complete</Badge>}
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={detailUser.email} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={detailUser.phone} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="County" value={detailUser.county} />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Joined" value={formatDate(detailUser.created_at)} />
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 text-sm font-semibold text-navy">Verification</h4>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    {detailUser.verification?.phone_verified ? (
                      <CheckCircle2 className="h-4 w-4 text-teal" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>Phone verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {detailUser.verification?.email_verified ? (
                      <CheckCircle2 className="h-4 w-4 text-teal" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>Email verified</span>
                  </div>
                  <div>
                    KYC: <Badge variant={kycVariant(detailUser.verification?.kyc_status ?? "not_started")}>
                      {detailUser.verification?.kyc_status ?? "not_started"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${(detailUser.verification?.risk_score ?? 0) >= 70 ? "text-destructive" : (detailUser.verification?.risk_score ?? 0) >= 40 ? "text-amber-600" : "text-muted-foreground"}`} />
                    Risk score: {detailUser.verification?.risk_score ?? 0}
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy">
                  <Wallet className="h-4 w-4" />
                  Wallet Summary
                </h4>
                {detailUser.wallet ? (
                  <div className="grid gap-2 text-sm sm:grid-cols-3">
                    <div className="rounded-lg bg-teal/10 p-3">
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="text-lg font-bold text-teal">KSh {Number(detailUser.wallet.available_balance).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 p-3">
                      <p className="text-xs text-muted-foreground">Pending</p>
                      <p className="text-lg font-bold text-amber-700">KSh {Number(detailUser.wallet.pending_balance).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-pesatrix-blue/10 p-3">
                      <p className="text-xs text-muted-foreground">Total Earned</p>
                      <p className="text-lg font-bold text-pesatrix-blue">KSh {Number(detailUser.wallet.total_earned).toLocaleString()}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No wallet data available.</p>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 text-sm font-semibold text-destructive">Actions</h4>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/wazim/users/${detailUser.id}`}>
                      <Edit3 className="mr-1 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                  {detailUser.phone && (
                    <>
                      <Button size="sm" variant="outline" asChild>
                        <a href={`tel:${normalizePhoneForTel(detailUser.phone)}`}>
                          <Phone className="mr-1 h-4 w-4" />
                          Call
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={`https://wa.me/${normalizePhoneForWhatsApp(detailUser.phone)}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="mr-1 h-4 w-4" />
                          WhatsApp
                        </a>
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <Link href={actionHref(detailUser.id)}>
                      <ClipboardList className="mr-1 h-4 w-4" />
                      Assign Task
                    </Link>
                  </Button>
                  {detailUser.status !== "suspended" && detailUser.status !== "banned" && !isSelf(detailUser.id) && (
                    <Button size="sm" variant="destructive" onClick={() => { setDetailOpen(false); openAction("suspend", detailUser.id, detailUser.full_name ?? "User"); }}>
                      <ShieldAlert className="mr-1 h-4 w-4" />
                      Suspend
                    </Button>
                  )}
                  {detailUser.status !== "suspended" && detailUser.status !== "banned" && !isSelf(detailUser.id) && (
                    <Button size="sm" variant="destructive" onClick={() => { setDetailOpen(false); openAction("ban", detailUser.id, detailUser.full_name ?? "User"); }}>
                      <ShieldX className="mr-1 h-4 w-4" />
                      Ban
                    </Button>
                  )}
                  {(detailUser.status === "suspended" || detailUser.status === "banned") && !isSelf(detailUser.id) && (
                    <Button size="sm" variant="default" onClick={() => { setDetailOpen(false); openAction("unblock", detailUser.id, detailUser.full_name ?? "User"); }}>
                      <ShieldCheck className="mr-1 h-4 w-4" />
                      Unblock
                    </Button>
                  )}
                  {!isSelf(detailUser.id) && (
                    <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); openAction("delete", detailUser.id, detailUser.full_name ?? "User"); }}>
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                  {isSelf(detailUser.id) && (
                    <p className="text-xs text-muted-foreground">You cannot perform actions on your own account.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Failed to load user details.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog.open} onOpenChange={(open) => {
        if (!open) setActionDialog((prev) => ({ ...prev, open: false, reason: "" }));
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog.action === "suspend" && <ShieldAlert className="h-5 w-5 text-amber-600" />}
              {actionDialog.action === "ban" && <ShieldX className="h-5 w-5 text-destructive" />}
              {actionDialog.action === "unblock" && <ShieldCheck className="h-5 w-5 text-teal" />}
              {actionDialog.action === "delete" && <Trash2 className="h-5 w-5 text-destructive" />}
              {actionDialog.action === "suspend" && "Suspend User"}
              {actionDialog.action === "ban" && "Ban User"}
              {actionDialog.action === "unblock" && "Unblock User"}
              {actionDialog.action === "delete" && "Delete User"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === "suspend" && `This will temporarily block ${actionDialog.userName}'s access and withdrawals.`}
              {actionDialog.action === "ban" && `This will permanently ban ${actionDialog.userName} from the platform.`}
              {actionDialog.action === "unblock" && `This will restore ${actionDialog.userName}'s access to the platform.`}
              {actionDialog.action === "delete" && `This will soft-delete ${actionDialog.userName}'s account. Their auth account will remain but they will be banned and hidden from listings.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="action-reason">Reason (required for audit log)</Label>
            <Textarea
              id="action-reason"
              value={actionDialog.reason}
              onChange={(e) => setActionDialog((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g. Fraud risk: duplicate devices and suspicious activity"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {actionDialog.reason.length}/500 characters (min 5)
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog((prev) => ({ ...prev, open: false, reason: "" }))}
              disabled={actionDialog.loading}
            >
              Cancel
            </Button>
            <Button
              variant={actionDialog.action === "unblock" ? "default" : "destructive"}
              onClick={executeAction}
              disabled={actionDialog.loading || !actionDialog.reason.trim() || actionDialog.reason.trim().length < 5}
            >
              {actionDialog.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm {actionDialog.action === "suspend" ? "Suspend" : actionDialog.action === "ban" ? "Ban" : actionDialog.action === "unblock" ? "Unblock" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "blue" | "teal" | "amber" | "red" }) {
  const toneClass = {
    blue: "bg-pesatrix-blue/10 text-pesatrix-blue",
    teal: "bg-teal/10 text-teal",
    amber: "bg-amber-500/10 text-amber-700",
    red: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <div className="rounded-lg border border-outline-variant/40 bg-white p-5 shadow-sm">
      <div className={`mb-4 h-2 w-14 rounded-full ${toneClass}`} />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-navy">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "active" || status === "activated"
      ? "success"
      : status === "suspended"
        ? "warning"
        : status === "banned"
          ? "destructive"
          : "muted";

  return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}

function kycVariant(kycStatus: string) {
  if (kycStatus === "verified" || kycStatus === "approved") return "success";
  if (kycStatus === "pending" || kycStatus === "under_review") return "warning";
  if (kycStatus === "rejected") return "destructive";
  return "muted";
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-navy">{value ?? "Not set"}</p>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return "Not set";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date);
}

function normalizePhoneForTel(phone: string) {
  return phone.trim();
}

function normalizePhoneForWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return digits;
}
