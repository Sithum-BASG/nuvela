"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { updateUser } from "@/lib/users-api";
import { ApiError } from "@/lib/api-client";
import type { OrgUser, UserRole } from "@/lib/users-api.types";

// OWNER role is never assignable via this form — only one owner per org and
// transfers happen through org-settings, not here.
const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "PROJECT_MANAGER", label: "Project Manager" },
  { value: "COLLABORATOR", label: "Collaborator" },
] as const;

type Props = {
  user: OrgUser | null;
  onClose: () => void;
  onUpdated: (user: OrgUser) => void;
};

export function EditUserModal({ user, onClose, onUpdated }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; role?: string }>({});

  // Sync the form to the selected user by adjusting state during render when the
  // target changes — React's documented alternative to a prop-sync effect
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const [syncedId, setSyncedId] = useState<string | null>(null);
  if (user && user.id !== syncedId) {
    setSyncedId(user.id);
    setName(user.name);
    setRole(user.role);
    setErrors({});
  }

  function validate() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Full name is required";
    if (!role) e.role = "Role is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !validate()) return;
    setLoading(true);
    try {
      const updated = await updateUser(user.id, { name: name.trim(), role: role as UserRole });
      toast.success("User updated");
      onUpdated(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error("You don't have permission to edit this user.");
      } else {
        toast.error("Failed to update user. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const isOwner = user?.role === "OWNER";

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[440px] gap-0 rounded-[14px] p-0 shadow-[0px_1px_2px_rgba(0,0,0,0.05),0px_12px_16px_rgba(0,0,0,0.10)]">
        <form onSubmit={handleSubmit} noValidate>
          {/* Header */}
          <div className="flex items-start justify-between px-6 pb-5 pt-6">
            <div className="flex flex-col gap-1">
              <DialogTitle className="font-display text-[20px] font-semibold leading-normal text-foreground">
                Edit user
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-5 text-text-secondary">
                Update details or change this person&apos;s role.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-0.5 flex size-[18px] items-center justify-center rounded text-text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Close"
            >
              <X className="size-[18px]" strokeWidth={1.75} />
            </button>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-5 px-6">
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="eu-name" className="text-[13px] font-medium text-foreground">
                Full name
              </Label>
              <Input
                id="eu-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Mercer"
                autoComplete="off"
                aria-describedby={errors.name ? "eu-name-err" : undefined}
                className={errors.name ? "border-destructive focus-visible:ring-destructive/30" : ""}
              />
              {errors.name && (
                <p id="eu-name-err" className="text-[12px] text-destructive">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="eu-email" className="text-[13px] font-medium text-foreground">
                Email
              </Label>
              {/* Email is read-only — backend doesn't allow changing it post-invite */}
              <Input
                id="eu-email"
                value={user?.email ?? ""}
                readOnly
                disabled
                className="cursor-default opacity-60"
              />
            </div>

            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="eu-role" className="text-[13px] font-medium text-foreground">
                Role
              </Label>
              {isOwner ? (
                <Input value="Owner" readOnly disabled className="cursor-default opacity-60" />
              ) : (
                <Select value={role} onValueChange={(v) => v && setRole(v as UserRole)}>
                  <SelectTrigger
                    id="eu-role"
                    aria-describedby={errors.role ? "eu-role-err" : undefined}
                    className={errors.role ? "border-destructive focus:ring-destructive/30" : ""}
                  >
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.role && (
                <p id="eu-role-err" className="text-[12px] text-destructive">
                  {errors.role}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-[10px] px-6 pb-5 pt-[24px]">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || isOwner}>
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
