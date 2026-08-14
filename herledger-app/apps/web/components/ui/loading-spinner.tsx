export function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{ display: "flex", justifyContent: "center", padding: "2rem" }}
    >
      <span
        style={{
          width: "1.5rem",
          height: "1.5rem",
          border: "2px solid var(--border)",
          borderTopColor: "var(--primary)",
          borderRadius: "50%",
          display: "inline-block",
          animation: "spin 0.75s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span className="sr-only">{label}</span>
    </div>
  );
}
