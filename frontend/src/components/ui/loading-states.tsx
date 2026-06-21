import { Skeleton } from "@/components/ui/skeleton";
import { SlowFetchNotice } from "@/components/ui/slow-fetch-notice";

export function LoadingShell({
  isSlow,
  children,
}: {
  isSlow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {children}
      {isSlow ? <SlowFetchNotice /> : null}
    </div>
  );
}

export function BoardSkeleton({ isSlow }: { isSlow?: boolean }) {
  return (
    <LoadingShell isSlow={isSlow}>
      <div className="flex min-h-[320px] flex-1 gap-4 overflow-x-auto pb-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex min-w-[260px] flex-1 flex-col gap-3">
            <Skeleton className="h-5 w-28" />
            {[1, 2].map((j) => (
              <Skeleton key={j} className="h-[108px] w-full rounded-card" />
            ))}
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}

export function BoardPageSkeleton({ isSlow }: { isSlow?: boolean }) {
  return (
    <div className="flex h-full flex-col p-6 sm:p-8">
      <div className="flex flex-1 flex-col gap-5 rounded-card bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32 rounded-control" />
            <Skeleton className="h-10 w-24 rounded-control" />
          </div>
        </div>
        <BoardSkeleton isSlow={isSlow} />
      </div>
    </div>
  );
}

export function ProjectsListSkeleton({ isSlow }: { isSlow?: boolean }) {
  return (
    <LoadingShell isSlow={isSlow}>
      <div className="flex flex-col gap-[10px] rounded-[12px] border border-border bg-card p-[10px]">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex h-[68px] items-center gap-[14px] rounded-[12px] border border-border px-4 py-3"
          >
            <Skeleton className="h-[38px] w-[10px] shrink-0 rounded-[3px]" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-56" />
            </div>
            <Skeleton className="h-[22px] w-14 rounded-[6px]" />
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}

export function ArchivedProjectsListSkeleton() {
  return (
    <div className="flex flex-col gap-[10px] rounded-[12px] border border-border bg-card p-[10px]">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex h-[64px] items-center gap-[14px] rounded-[12px] border border-border px-4 py-3"
        >
          <Skeleton className="h-[36px] w-[10px] shrink-0 rounded-[3px]" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2.5 w-56" />
          </div>
          <Skeleton className="h-[22px] w-16 rounded-[6px]" />
          <Skeleton className="h-8 w-24 rounded-[8px]" />
        </div>
      ))}
    </div>
  );
}

export function UsersTableSkeleton({ isSlow }: { isSlow?: boolean }) {
  return (
    <LoadingShell isSlow={isSlow}>
      <div className="flex flex-col">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex h-[64px] items-center border-b border-border px-5">
            <div className="flex flex-1 items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
            <div className="w-[140px]">
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="w-[130px]">
              <Skeleton className="h-[22px] w-14 rounded-[6px]" />
            </div>
            <div className="w-[90px]" />
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}

export function TaskRowSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-[10px]" />
      ))}
    </div>
  );
}

export function AttachmentRowSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[60px] w-full rounded-[10px]" />
      ))}
    </div>
  );
}

export function ActivityRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3 pl-1">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-[8px]" />
      ))}
    </div>
  );
}

export function ChecklistSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full rounded-[6px]" />
      ))}
    </div>
  );
}

export function NotificationListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-[59px] w-full rounded-[10px]" />
      ))}
    </div>
  );
}

export function NotificationDropdownSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[52px] w-full rounded-[8px]" />
      ))}
    </div>
  );
}

export function LabelListSkeleton() {
  return (
    <div className="flex flex-col gap-1 py-1">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-7 w-full rounded-[6px]" />
      ))}
    </div>
  );
}

export function RemoveMemberCheckSkeleton() {
  return (
    <div className="mt-[18px] flex flex-col gap-2 px-6">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="flex h-[60px] items-center gap-3 rounded-[10px] border border-border bg-card px-[14px]"
        >
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-8 w-[180px] rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function ProjectSettingsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-8">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-7 rounded-[8px]" />
        <Skeleton className="h-7 w-48" />
      </div>
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-64 w-full rounded-[12px]" />
    </div>
  );
}

export function MemberListSkeleton() {
  return (
    <div className="flex flex-col gap-1 rounded-[12px] border border-border bg-card p-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex h-[60px] items-center gap-3 rounded-[10px] border border-border px-[14px]"
        >
          <Skeleton className="size-[34px] rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-44" />
          </div>
        </div>
      ))}
    </div>
  );
}
