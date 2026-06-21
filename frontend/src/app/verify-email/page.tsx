"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  AuthCard,
  AuthHeader,
  AuthLayout,
} from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { ErrorCallout } from "@/components/ui/error-callout";
import { authApi, ApiError } from "@/lib/auth-api";

type Status = "verifying" | "success" | "error";

function VerifyContent() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // React 19 Strict Mode runs effects twice in dev; guard the one-shot call.
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    authApi
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setErrorMessage(
          err instanceof ApiError ? err.message : "This link is invalid or has expired.",
        );
        setStatus("error");
      });
  }, [token]);

  if (status === "verifying") {
    return (
      <AuthCard>
        <AuthHeader
          title="Verifying your email"
          subtitle="Hang tight while we confirm your link."
        />
      </AuthCard>
    );
  }

  if (status === "error") {
    return (
      <AuthCard>
        <AuthHeader
          title="Verification failed"
          subtitle="We couldn't confirm your email address."
        />
        <ErrorCallout
          variant="not-found"
          title="Invalid or expired link"
          description={
            errorMessage ??
            "This link is invalid or has expired. Try logging in to request a new one."
          }
          className="w-full"
        />
        <div className="w-full">
          <Button
            type="button"
            className="w-full"
            onClick={() => router.push("/login")}
          >
            Back to log in
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthHeader
        title="Email verified"
        subtitle="Your email is confirmed. You can now log in to your workspace."
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

export default function VerifyEmailResultPage() {
  return (
    <AuthLayout>
      <Suspense fallback={null}>
        <VerifyContent />
      </Suspense>
    </AuthLayout>
  );
}
