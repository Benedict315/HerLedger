import type { EventStatus, AttestationStatus } from "@herledger/sdk";

type Status = EventStatus | AttestationStatus;

const STATUS_STYLES: Record<Status, { background: string; color: string; label: string }> = {
  Pending: { background: "#fef9c3", color: "#854d0e", label: "Pending" },
  Verified: { background: "#dcfce7", color: "#166534", label: "Verified" },
  Disputed: { background: "#ffedd5", color: "#9a3412", label: "Disputed" },
  Revoked: { background: "#fee2e2", color: "#991b1b", label: "Revoked" },
  Active: { background: "#dcfce7", color: "#166534", label: "Active" },
};

interface StatusBadgeProps {
  status: Status;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? { background: "#f5f5f4", color: "#57534e", label: status };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.125rem 0.5rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 500,
        background: style.background,
        color: style.color,
      }}
      aria-label={`Status: ${style.label}`}
    >
      {style.label}
    </span>
  );
}
