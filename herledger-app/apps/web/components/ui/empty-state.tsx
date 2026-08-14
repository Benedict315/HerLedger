interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "3rem 2rem",
        border: "1px dashed var(--border)",
        borderRadius: "var(--radius)",
        color: "var(--muted)",
      }}
    >
      <p style={{ fontWeight: 500, marginBottom: description ? "0.5rem" : 0 }}>{title}</p>
      {description && <p style={{ fontSize: "0.875rem", margin: 0 }}>{description}</p>}
    </div>
  );
}
