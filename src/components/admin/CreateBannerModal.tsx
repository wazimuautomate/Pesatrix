"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

type CreateBannerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  banner?: BannerFormValue | null;
};

export type BannerFormValue = {
  id: string;
  title: string;
  message: string;
  type: string;
  target: string;
  target_user_id?: string | null;
  is_dismissible: boolean;
  expires_at: string | null;
};

const EMPTY_FORM = {
  title: "",
  message: "",
  type: "info",
  target: "all",
  target_user_id: "",
  is_dismissible: true,
  expires_at: "",
};

export function CreateBannerModal({ open, onOpenChange, onSuccess, banner }: CreateBannerModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const isEditing = Boolean(banner?.id);

  useEffect(() => {
    if (!open) return;

    if (banner) {
      setFormData({
        title: banner.title ?? "",
        message: banner.message ?? "",
        type: banner.type ?? "info",
        target: banner.target ?? "all",
        target_user_id: banner.target_user_id ?? "",
        is_dismissible: banner.is_dismissible ?? true,
        expires_at: toDatetimeLocalInputValue(banner.expires_at),
      });
    } else {
      setFormData(EMPTY_FORM);
      setSelectedUser(null);
      setSearch("");
    }
  }, [banner, open]);

  useEffect(() => {
    if (!search || formData.target !== "specific_user") {
      setUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}`);
        const data = await res.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error("Failed to search users", err);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search, formData.target]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(isEditing ? `/api/admin/banners/${banner!.id}` : "/api/admin/banners", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...formData,
            expires_at: formData.expires_at || null,
            target_user_id: formData.target_user_id || null,
        }),
      });

      if (!res.ok) throw new Error(isEditing ? "Failed to update banner" : "Failed to create banner");

      onSuccess();
      onOpenChange(false);
      setFormData(EMPTY_FORM);
      setSelectedUser(null);
      setSearch("");
    } catch (error) {
      console.error(error);
      alert(isEditing ? "Failed to update banner" : "Failed to create banner");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] overflow-y-auto p-4 sm:max-w-[680px] sm:p-6">
        <DialogTitle>{isEditing ? "Edit Banner" : "Create New Banner"}</DialogTitle>
        <DialogDescription>
          Broadcast a message to users. You can target specific users or everyone.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Scheduled Maintenance"
            />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <RichTextEditor
              value={formData.message}
              onChange={(message) => setFormData({ ...formData, message })}
              placeholder="Banner details..."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(val) => setFormData({ ...formData, type: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="fraud">Fraud Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target</Label>
              <Select
                value={formData.target}
                onValueChange={(val) => {
                  setFormData({ ...formData, target: val, target_user_id: "" });
                  setSelectedUser(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="activated">Activated Users Only</SelectItem>
                  <SelectItem value="specific_user">Specific User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.target === "specific_user" && (
            <div className="space-y-2 p-3 bg-muted/30 rounded-xl border">
              <Label>Select User</Label>
              <Input
                placeholder="Search by phone or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searching && <p className="text-xs text-muted-foreground mt-1">Searching...</p>}
              {users.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className={`p-2 text-sm border rounded-lg cursor-pointer ${
                        formData.target_user_id === u.id ? "border-pesatrix-blue bg-pesatrix-blue/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setFormData({ ...formData, target_user_id: u.id });
                        setSelectedUser(u);
                      }}
                    >
                      <div className="font-medium">{u.full_name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{u.phone}</div>
                    </div>
                  ))}
                </div>
              )}
              {selectedUser && (
                <div className="mt-3 p-3 bg-green-50/50 border border-green-200 rounded-lg flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-green-700">Selected Recipient</p>
                    <p className="text-sm font-semibold text-navy mt-0.5 truncate">{selectedUser.full_name || "Unnamed user"}</p>
                    {selectedUser.phone && <p className="text-xs text-muted-foreground mt-0.5">{selectedUser.phone}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => {
                      setFormData({ ...formData, target_user_id: "" });
                      setSelectedUser(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Expires At (Optional)</Label>
            <Input
              type="datetime-local"
              value={formData.expires_at}
              onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_dismissible"
              checked={formData.is_dismissible}
              onCheckedChange={(checked) => setFormData({ ...formData, is_dismissible: !!checked })}
            />
            <Label htmlFor="is_dismissible">Allow users to dismiss this banner</Label>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || (formData.target === "specific_user" && !formData.target_user_id)}
            >
              {loading ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Banner")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toDatetimeLocalInputValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
