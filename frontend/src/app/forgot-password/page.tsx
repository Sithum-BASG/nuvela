"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  AuthCard,
  AuthFooter,
  AuthHeader,
  AuthLayout,
} from "@/components/auth/auth-shell";
import { Field } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { ButtonPendingLabel } from "@/components/ui/button-pending-label";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/auth-api";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/lib/auth-schemas";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    // The endpoint always returns 200 to avoid user enumeration, so we show
    // the same confirmation regardless of whether the account exists.
    await authApi.forgotPassword(values.email).catch(() => {});
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <AuthLayout>
        <AuthCard>
          <AuthHeader
            title="Check your inbox"
            subtitle={`If an account exists for ${sentTo}, we've sent a password reset link.`}
          />
          <AuthFooter prompt="Remembered it?">
            <Link
              href="/login"
              className="font-medium text-accent-strong hover:underline"
            >
              Back to login
            </Link>
          </AuthFooter>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Reset your password"
          subtitle="Enter your email and we'll send you a reset link."
        />

        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full flex-col gap-4"
        >
          <Field label="Email address" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </Field>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            <ButtonPendingLabel pending={isSubmitting} label="Send reset link" pendingLabel="Sending…" />
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
    </AuthLayout>
  );
}
