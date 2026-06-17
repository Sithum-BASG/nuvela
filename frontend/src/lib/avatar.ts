// Deterministic avatar styling from a name. The board/card avatars in Figma use
// a small palette of brand-adjacent fills (teal/blue/violet/rose/green) with
// white initials — we map a name hash onto the Design-Brief avatar tokens so the
// same person always gets the same color across screens. Tokens only (no hex).
const AVATAR_COLORS = [
  "bg-avatar-violet",
  "bg-avatar-blue",
  "bg-avatar-teal",
] as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
