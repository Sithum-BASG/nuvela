"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  AuthCard,
  AuthFooter,
  AuthHeader,
  AuthLayout,
} from "@/components/auth/auth-shell";
import { Field, FieldError } from "@/components/auth/field";
import { ErrorCallout } from "@/components/ui/error-callout";
import { Button } from "@/components/ui/button";
import { ButtonPendingLabel } from "@/components/ui/button-pending-label";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError, authApi } from "@/lib/auth-api";
import { loginSchema, type LoginValues } from "@/lib/auth-schemas";
import { useAuth } from "@/providers/auth-provider";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const reason = searchParams.get("reason");
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      const result = await authApi.login(values);
      // Update the auth context so the provider knows the session is active
      // before we navigate (avoids a stale-unauthenticated redirect race).
      login({ ...result.user, mustResetPassword: result.mustResetPassword });
      if (result.mustResetPassword) {
        router.push("/first-login/reset-password");
      } else {
        router.push(redirectTo ?? "/dashboard");
      }
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  return (
    <AuthCard>
      <AuthHeader
        title="Welcome back"
        subtitle="Log in to your Nuvela workspace"
      />

      {reason === "expired" && (
        <ErrorCallout variant="notice" className="w-full" />
      )}

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

        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-[13px] leading-5 font-medium text-foreground"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-accent-strong hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password && <FieldError>{errors.password.message}</FieldError>}
        </div>

        {formError && <FieldError>{formError}</FieldError>}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          <ButtonPendingLabel pending={isSubmitting} label="Log in" pendingLabel="Logging in…" />
        </Button>
      </form>

      <AuthFooter prompt="Don't have an account?">
        <Link
          href="/signup"
          className="font-medium text-accent-strong hover:underline"
        >
          Sign up
        </Link>
      </AuthFooter>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
