"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ButtonPendingLabel } from "@/components/ui/button-pending-label";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError, authApi } from "@/lib/auth-api";
import {
  accountProfileSchema,
  changePasswordSchema,
  type AccountProfileValues,
  type ChangePasswordValues,
} from "@/lib/auth-schemas";
import { avatarColor, initials } from "@/lib/avatar";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

// Account settings — App Flow /settings/account; Figma wireframe 17:142.
type Tab = "profile" | "password" | "preferences";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  COLLABORATOR: "Collaborator",
};

export default function AccountSettingsPage() {
  const { user, logout, refreshSession } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileForm = useForm<AccountProfileValues>({
    resolver: zodResolver(accountProfileSchema),
    defaultValues: { name: user?.name ?? "" },
  });

  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({ name: user.name });
    }
  }, [user, profileForm]);

  async function onSaveProfile(values: AccountProfileValues) {
    setProfileError(null);
    try {
      await authApi.updateAccount(values);
      await refreshSession();
      toast.success("Profile updated");
    } catch (err) {
      setProfileError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  async function onChangePassword(values: ChangePasswordValues) {
    setPasswordError(null);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success("Password changed. Please sign in again.");
      logout();
    } catch (err) {
      setPasswordError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <PageHeader
        title="Account settings"
        subtitle="Manage your profile and preferences."
      />

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["profile", "Profile"],
            ["password", "Password"],
            ["preferences", "Preferences"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors motion-reduce:transition-none",
              tab === key
                ? "border-primary text-foreground"
                : "border-transparent text-text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <section className="rounded-card border border-border bg-card p-7">
          <div className="mb-6 flex items-center gap-4">
            <span
              className={cn(
                "flex size-[72px] items-center justify-center rounded-full text-2xl font-medium text-white",
                avatarColor(user.name),
              )}
              aria-hidden
            >
              {initials(user.name)}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="text-sm text-text-muted">
                {ROLE_LABEL[user.role] ?? user.role}
              </p>
            </div>
          </div>

          <form
            noValidate
            onSubmit={profileForm.handleSubmit(onSaveProfile)}
            className="flex flex-col gap-5"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                autoComplete="name"
                aria-invalid={!!profileForm.formState.errors.name}
                {...profileForm.register("name")}
              />
              {profileForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {profileForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" value={user.email} readOnly disabled />
            </div>

            {profileError && (
              <p className="text-sm text-destructive" role="alert">
                {profileError}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                <ButtonPendingLabel
                  pending={profileForm.formState.isSubmitting}
                  label="Save changes"
                  pendingLabel="Saving…"
                />
              </Button>
            </div>
          </form>
        </section>
      )}

      {tab === "password" && (
        <section className="rounded-card border border-border bg-card p-7">
          <form
            noValidate
            onSubmit={passwordForm.handleSubmit(onChangePassword)}
            className="flex max-w-md flex-col gap-5"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <PasswordInput
                id="currentPassword"
                autoComplete="current-password"
                {...passwordForm.register("currentPassword")}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="newPassword">New password</Label>
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                {...passwordForm.register("newPassword")}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                {...passwordForm.register("confirmPassword")}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {passwordError && (
              <p className="text-sm text-destructive" role="alert">
                {passwordError}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                <ButtonPendingLabel
                  pending={passwordForm.formState.isSubmitting}
                  label="Update password"
                  pendingLabel="Updating…"
                />
              </Button>
            </div>
          </form>
        </section>
      )}

      {tab === "preferences" && (
        <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="text-sm text-text-muted">
                Switch between light and dark mode.
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">Session</p>
              <p className="text-sm text-text-muted">
                Sign out of Nuvela on this device.
              </p>
            </div>
            <Button
              variant="outline"
              className="mt-4 gap-2"
              onClick={() => void logout()}
            >
              <LogOut className="size-4" strokeWidth={1.75} aria-hidden />
              Log out
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
