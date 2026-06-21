"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  AuthCard,
  AuthHeader,
  AuthLayout,
} from "@/components/auth/auth-shell";
import { Field, FieldError } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { ButtonPendingLabel } from "@/components/ui/button-pending-label";
import { PasswordInput } from "@/components/ui/password-input";
import { authApi } from "@/lib/auth-api";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/auth-schemas";
import { useAuth } from "@/providers/auth-provider";

// Admin-provisioned users land here after their first login (mustResetPassword
// === true). They're already authenticated via the session cookie, so there's
// no token — the endpoint reads the current user.
export default function FirstLoginResetPasswordPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null);
    try {
      await authApi.firstLoginResetPassword(values.newPassword);
      // Re-fetch the session so the provider sees mustResetPassword = false
      // before we navigate, avoiding a redirect loop back to this page.
      await refreshSession();
      router.push("/dashboard");
    } catch {
      setFormError("Something went wrong. Please try again.");
    }
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Set your password"
          subtitle="Choose a new password to finish setting up your account."
        />

        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full flex-col gap-4"
        >
          <Field
            label="New password"
            htmlFor="newPassword"
            error={errors.newPassword?.message}
          >
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              placeholder="Enter a new password"
              aria-invalid={!!errors.newPassword}
              {...register("newPassword")}
            />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
          >
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
          </Field>

          {formError && <FieldError>{formError}</FieldError>}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            <ButtonPendingLabel pending={isSubmitting} label="Update password" pendingLabel="Updating…" />
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
