import { avatarColor, initials } from "@/lib/avatar";
import type { ProjectMemberPreview } from "@/lib/projects-api.types";
import { cn } from "@/lib/utils";

// Overlapping member avatars — Figma "Avatar" stack on Project List Row (36px)
// and Project Card (24px) with optional +N overflow chip.
type Props = {
  members: ProjectMemberPreview[];
  memberCount: number;
  size?: "sm" | "md";
  className?: string;
};

const SIZE = {
  sm: "size-6 text-[10px] rounded-[12px] -mr-2 border-[1.5px]",
  md: "size-9 text-[13px] rounded-full -mr-2.5 border-2",
} as const;

export function MemberAvatarStack({
  members,
  memberCount,
  size = "md",
  className,
}: Props) {
  const overflow = Math.max(0, memberCount - members.length);
  const sizeClass = SIZE[size];

  if (members.length === 0 && overflow === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center", className)}>
      {members.map((member) => (
        <span
          key={member.userId}
          className={cn(
            "flex shrink-0 items-center justify-center border-card font-medium text-white",
            sizeClass,
            avatarColor(member.name),
          )}
          title={member.name}
        >
          {initials(member.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center border-card bg-surface-muted font-medium text-text-secondary",
            sizeClass,
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
