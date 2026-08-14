interface SubmitButtonProps {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
}

export function SubmitButton({ children, loading, disabled }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      aria-busy={loading}
      style={{
        width: "100%",
        padding: "0.625rem 1rem",
        background: loading || disabled ? "var(--muted)" : "var(--primary)",
        color: "#fff",
        border: "none",
        borderRadius: "var(--radius)",
        fontSize: "1rem",
        fontWeight: 500,
        cursor: loading || disabled ? "not-allowed" : "pointer",
        marginTop: "0.5rem",
      }}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
