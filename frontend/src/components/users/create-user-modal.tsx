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
import { createUser } from "@/lib/users-api";
import { ApiError } from "@/lib/api-client";
import type { OrgUser, UserRole } from "@/lib/users-api.types";

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "PROJECT_MANAGER", label: "Project Manager" },
  { value: "COLLABORATOR", label: "Collaborator" },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (user: OrgUser) => void;
};

export function CreateUserModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("COLLABORATOR");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; role?: string }>({});

  function validate() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Full name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";
    if (!role) e.role = "Role is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const user = await createUser({ name: name.trim(), email: email.trim(), role });
      toast.success(`Invite sent to ${email.trim()}`);
      onCreated(user);
      handleClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: "A user with this email already exists" });
      } else {
        toast.error("Failed to create user. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setName("");
    setEmail("");
    setRole("COLLABORATOR");
    setErrors({});
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-[440px] gap-0 rounded-[14px] p-0 shadow-[0px_1px_2px_rgba(0,0,0,0.05),0px_12px_16px_rgba(0,0,0,0.10)]">
        <form onSubmit={handleSubmit} noValidate>
          {/* Header */}
          <div className="flex items-start justify-between px-6 pb-5 pt-6">
            <div className="flex flex-col gap-1">
              <DialogTitle className="font-display text-[20px] font-semibold leading-normal text-foreground">
                Create user
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-5 text-text-secondary">
                They'll receive an email invite with a temporary password.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="mt-0.5 flex size-[18px] items-center justify-center rounded text-text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Close"
            >
              <X className="size-[18px]" strokeWidth={1.75} />
            </button>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-5 px-6">
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="cu-name" className="text-[13px] font-medium text-foreground">
                Full name
              </Label>
              <Input
                id="cu-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Cooper"
                autoComplete="off"
                aria-describedby={errors.name ? "cu-name-err" : undefined}
                className={errors.name ? "border-destructive focus-visible:ring-destructive/30" : ""}
              />
              {errors.name && (
                <p id="cu-name-err" className="text-[12px] text-destructive">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="cu-email" className="text-[13px] font-medium text-foreground">
                Email
              </Label>
              <Input
                id="cu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@acme.co"
                autoComplete="off"
                aria-describedby={errors.email ? "cu-email-err" : undefined}
                className={errors.email ? "border-destructive focus-visible:ring-destructive/30" : ""}
              />
              {errors.email && (
                <p id="cu-email-err" className="text-[12px] text-destructive">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="cu-role" className="text-[13px] font-medium text-foreground">
                Role
              </Label>
              <Select value={role} onValueChange={(v) => { if (v) setRole(v as UserRole); }}>
                <SelectTrigger
                  id="cu-role"
                  aria-describedby={errors.role ? "cu-role-err" : undefined}
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
              {errors.role && (
                <p id="cu-role-err" className="text-[12px] text-destructive">
                  {errors.role}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-[10px] px-6 pb-5 pt-[24px]">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
