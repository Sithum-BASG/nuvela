"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { ButtonPendingLabel } from "@/components/ui/button-pending-label";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError, authApi } from "@/lib/auth-api";
import { signupSchema, type SignupValues } from "@/lib/auth-schemas";

export default function SignupPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", orgName: "", password: "" },
  });

  async function onSubmit(values: SignupValues) {
    setFormError(null);
    try {
      await authApi.signup(values);
      // Backend sends a verification email; show the pending screen with the
      // address so the user knows where to look.
      router.push(
        `/verify-email/pending?email=${encodeURIComponent(values.email)}`
      );
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.status === 400
          ? err.message || "Please check your details and try again."
          : "Something went wrong. Please try again."
      );
    }
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Create your account"
          subtitle="Start your free Nuvela workspace"
        />

        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full flex-col gap-4"
        >
          <Field label="Full name" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Alex Mercer"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
          </Field>

          <Field label="Work email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </Field>

          <Field
            label="Organization name"
            htmlFor="orgName"
            error={errors.orgName?.message}
          >
            <Input
              id="orgName"
              autoComplete="organization"
              placeholder="Acme Inc."
              aria-invalid={!!errors.orgName}
              {...register("orgName")}
            />
          </Field>

          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="Create a strong password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
          </Field>

          {formError && <FieldError>{formError}</FieldError>}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            <ButtonPendingLabel
              pending={isSubmitting}
              label="Create workspace"
              pendingLabel="Creating workspace…"
            />
          </Button>
        </form>

        <AuthFooter prompt="Already have an account?">
          <Link
            href="/login"
            className="font-medium text-accent-strong hover:underline"
          >
            Log in
          </Link>
        </AuthFooter>
      </AuthCard>
    </AuthLayout>
  );
}
