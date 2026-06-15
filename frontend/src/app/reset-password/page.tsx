"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  AuthCard,
  AuthFooter,
  AuthHeader,
  AuthLayout,
} from "@/components/auth/auth-shell";
import { Field, FieldError } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError, authApi } from "@/lib/auth-api";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/auth-schemas";

function ResetContent() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    if (!token) {
      setFormError("This reset link is invalid or has expired.");
      return;
    }
    try {
      await authApi.resetPassword({
        token,
        newPassword: values.newPassword,
      });
      setDone(true);
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.status === 401
          ? "This reset link is invalid or has expired."
          : "Something went wrong. Please try again."
      );
    }
  }

  if (done) {
    return (
      <AuthCard>
        <AuthHeader
          title="Password updated"
          subtitle="Your password has been changed. You can now log in with your new password."
        />
        <div className="w-full">
          <Button
            type="button"
            className="w-full"
            onClick={() => router.push("/login")}
          >
            Continue to log in
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthHeader />
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-full flex-col gap-4"
      >
        <h1 className="font-display text-xl leading-6 font-semibold text-foreground">
          Reset your password
        </h1>

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
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>

      <AuthFooter prompt="Remembered it?">
        <Link
          href="/login"
          className="font-medium text-accent-strong hover:underline"
        >
          Back to login
        </Link>
      </AuthFooter>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={null}>
        <ResetContent />
      </Suspense>
    </AuthLayout>
  );
}
