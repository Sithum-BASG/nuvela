import type { ComponentProps, ReactNode } from "react";

import { ShaderBackground } from "@/components/ui/shader-background";
import { LogoSymbol } from "@/components/logo";
import { cn } from "@/lib/utils";

// The centered auth surface shared by every /login, /signup, /verify-email,
// /forgot-password and /reset-password screen. Mirrors the Figma "Auth Card":
// 440px wide, 32px padding, 24px gap, surface + border, 12px radius, centered
// on the app background.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <ShaderBackground />
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </main>
  );
}

export function AuthCard({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[440px] flex-col items-center gap-6 rounded-xl border border-border bg-card p-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Card head: logo plus optional title/subtitle. Some screens (verify-email
// pending, reset-password) show only the logo, so the texts are optional.
export function AuthHeader({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <LogoSymbol className="size-12" />
      {(title || subtitle) && (
        <div className="flex flex-col items-center gap-2 text-center">
          {title && (
            <h1 className="font-display text-xl leading-6 font-semibold text-foreground">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm leading-[21px] text-text-secondary">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Footer link row ("Don't have an account? Sign up"). The accent link uses the
// stronger accent token to match the Figma link color.
export function AuthFooter({
  prompt,
  children,
}: {
  prompt: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-1 text-sm">
      <span className="leading-[21px] text-text-secondary">{prompt}</span>
      {children}
    </div>
  );
}
