"use client";

import { PageHeader } from "@/components/app/page-header";
import { MyWorkDashboard } from "@/components/dashboard/my-work-dashboard";
import { OrgOverviewDashboard } from "@/components/dashboard/org-overview-dashboard";
import { useAuth } from "@/providers/auth-provider";

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const firstName = user.name.split(/\s+/)[0];
  const isManagerial = user.role === "OWNER" || user.role === "ADMIN";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 sm:p-8">
      <PageHeader
        title="Dashboard"
        subtitle={
          isManagerial
            ? `Welcome back, ${firstName}`
            : "Your assigned work at a glance"
        }
      />

      {isManagerial ? (
        <OrgOverviewDashboard role={user.role} />
      ) : (
        <MyWorkDashboard />
      )}
    </div>
  );
}
