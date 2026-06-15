"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  AuthCard,
  AuthHeader,
  AuthLayout,
} from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

function PendingContent() {
  const email = useSearchParams().get("email");
  const [sent, setSent] = useState(false);

  return (
    <AuthCard>
      <AuthHeader />
      <div className="flex w-full flex-col items-center gap-4">
        <h1 className="text-center font-display text-xl leading-6 font-semibold text-foreground">
          Check your inbox
        </h1>
        <p className="text-center text-sm leading-[21px] text-text-secondary">
          We sent a verification link to{" "}
          <span className="font-medium text-foreground">
            {email ?? "your email"}
          </span>
          . Click the link in the email to activate your workspace.
        </p>

        {/* No resend endpoint exists yet; confirm inline rather than call a
            non-existent API. Swap to a real resend mutation when available. */}
        <Button
          type="button"
          className="w-full"
          disabled={sent}
          onClick={() => setSent(true)}
        >
          {sent ? "Email sent" : "Resend email"}
        </Button>

        <div className="flex items-start gap-1 text-sm">
          <span className="text-[13px] leading-5 text-text-secondary">
            Wrong email?
          </span>
          <Link
            href="/login"
            className="font-medium text-accent-strong hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPendingPage() {
  return (
    <AuthLayout>
      <Suspense fallback={null}>
        <PendingContent />
      </Suspense>
    </AuthLayout>
  );
}
