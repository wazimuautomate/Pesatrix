"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import { AdminPageShell } from "@/components/admin/admin-native";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateBannerModal } from "@/components/admin/CreateBannerModal";

type Banner = {
  id: string;
  title: string;
  message: string;
  type: string;
  target: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/banners");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to fetch banners");
        return;
      }
      setBanners(data.items ?? []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      
      toast.success(`Banner ${!currentActive ? "activated" : "deactivated"}`);
      fetchBanners();
    } catch {
      toast.error("Failed to update banner status");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner? This cannot be undone.")) return;
    
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete banner");
      
      toast.success("Banner deleted");
      fetchBanners();
    } catch {
      toast.error("Failed to delete banner");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <AdminPageShell
      admin={{
        role: "admin",
        userId: "",
        email: "",
        adminUserId: "",
      }}
      title="Banners & Notifications"
      description="Manage platform-wide and targeted announcements displayed on the user dashboard."
      headerVariant="logoOnly"
      actions={
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="mr-1 h-4 w-4" /> New Banner
        </Button>
      }
    >
      <div className="mt-4 rounded-lg border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={5} columns={7} />
            ) : banners.length === 0 ? (
              <TableRow>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Megaphone className="h-8 w-8 opacity-20" />
                    <p>No banners created yet.</p>
                  </div>
                </td>
              </TableRow>
            ) : (
              banners.map((banner) => (
                <TableRow key={banner.id}>
                  <td className="font-medium max-w-[200px] truncate" title={banner.message}>
                    {banner.title}
                  </td>
                  <td>
                    <Badge variant="outline" className="capitalize">
                      {banner.type}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant="secondary" className="capitalize">
                      {banner.target.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="text-sm text-muted-foreground">
                    {banner.expires_at ? new Date(banner.expires_at).toLocaleDateString() : "Never"}
                  </td>
                  <td>
                    <Switch
                      checked={banner.is_active}
                      onCheckedChange={() => handleToggleActive(banner.id, banner.is_active)}
                      disabled={actionLoading[banner.id]}
                    />
                  </td>
                  <td className="text-sm text-muted-foreground">
                    {new Date(banner.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(banner.id)}
                      disabled={actionLoading[banner.id]}
                    >
                      {actionLoading[banner.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateBannerModal
        open={showModal}
        onOpenChange={setShowModal}
        onSuccess={fetchBanners}
      />
    </AdminPageShell>
  );
}
