export function assistantPrompts(role?: string): string[] {
  switch ((role ?? "").toUpperCase()) {
    case "ADMIN":
      return [
        "Show pending invites",
        "List recently added users",
        "Show inactive users",
        "Summarize user status changes",
      ];
    case "COLLABORATOR":
      return [
        "What am I assigned right now?",
        "Show my overdue tasks",
        "What moved to review today?",
        "Draft a status update on my work",
      ];
    case "OWNER":
    case "PROJECT_MANAGER":
    default:
      return [
        "Review project status",
        "Show tasks at risk",
        "Summarize recent activity",
        "Draft a follow-up comment",
      ];
  }
}
