import { InlineSpinner } from "@/components/ui/inline-spinner";

export function ButtonPendingLabel({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  if (!pending) return label;
  return (
    <>
      <InlineSpinner />
      {pendingLabel}
    </>
  );
}
